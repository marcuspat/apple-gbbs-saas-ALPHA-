const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class PaymentService {
    constructor() {
        this.plans = {
            hobbyist: {
                id: 'hobbyist',
                name: 'Hobbyist',
                price: 900, // $9.00 in cents
                interval: 'month',
                features: [
                    'Personal BBS instance',
                    'Up to 50 users', 
                    'Basic message boards (5 boards)',
                    'File sharing (1GB storage)',
                    'Standard themes',
                    'Community support'
                ]
            },
            community: {
                id: 'community',
                name: 'Community',
                price: 2900, // $29.00 in cents
                interval: 'month',
                features: [
                    'Enhanced BBS instance',
                    'Up to 250 users',
                    'Advanced message boards (25 boards)',
                    'File sharing (10GB storage)',
                    'Multiple color themes',
                    'Door games access',
                    'Custom welcome screen',
                    'AI-powered features',
                    'Priority support'
                ]
            },
            enterprise: {
                id: 'enterprise',
                name: 'Enterprise',
                price: 9900, // $99.00 in cents
                interval: 'month',
                features: [
                    'Multi-tenant hosting',
                    'Unlimited users',
                    'Unlimited boards',
                    '100GB storage',
                    'White-label branding',
                    'Custom domains',
                    'API access',
                    'Advanced AI features',
                    'Admin analytics dashboard',
                    '24/7 premium support'
                ]
            }
        };
    }
    
    async createCustomer(email, name, metadata = {}) {
        try {
            const customer = await stripe.customers.create({
                email,
                name,
                metadata: {
                    ...metadata,
                    created_via: 'retrobbs_saas'
                }
            });
            
            return customer;
        } catch (error) {
            console.error('Stripe customer creation failed:', error);
            throw new Error('Failed to create customer');
        }
    }
    
    async createSubscription(customerId, planId, trialDays = 7) {
        try {
            const plan = this.plans[planId];
            if (!plan) {
                throw new Error('Invalid plan selected');
            }
            
            // Create or retrieve the price in Stripe
            const price = await this.getOrCreatePrice(plan);
            
            const subscription = await stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: price.id }],
                trial_period_days: trialDays,
                metadata: {
                    plan_id: planId,
                    plan_name: plan.name
                },
                expand: ['latest_invoice.payment_intent']
            });
            
            return subscription;
        } catch (error) {
            console.error('Stripe subscription creation failed:', error);
            throw new Error('Failed to create subscription');
        }
    }
    
    async getOrCreatePrice(plan) {
        try {
            // First, try to find existing price
            const prices = await stripe.prices.list({
                lookup_keys: [`retrobbs_${plan.id}`],
                limit: 1
            });
            
            if (prices.data.length > 0) {
                return prices.data[0];
            }
            
            // Create new price if not found
            const price = await stripe.prices.create({
                unit_amount: plan.price,
                currency: 'usd',
                recurring: { interval: plan.interval },
                product_data: {
                    name: `RetroBBS ${plan.name} Plan`,
                    description: plan.features.join(', '),
                    metadata: {
                        plan_id: plan.id
                    }
                },
                lookup_key: `retrobbs_${plan.id}`
            });
            
            return price;
        } catch (error) {
            console.error('Stripe price creation failed:', error);
            throw new Error('Failed to create pricing');
        }
    }
    
    async createPaymentMethod(customerId, paymentMethodId) {
        try {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId,
            });
            
            await stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });
            
            return true;
        } catch (error) {
            console.error('Payment method attachment failed:', error);
            throw new Error('Failed to attach payment method');
        }
    }
    
    async createCheckoutSession(planId, customerId, successUrl, cancelUrl) {
        try {
            const plan = this.plans[planId];
            if (!plan) {
                throw new Error('Invalid plan selected');
            }
            
            const price = await this.getOrCreatePrice(plan);
            
            const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                customer: customerId,
                line_items: [
                    {
                        price: price.id,
                        quantity: 1,
                    },
                ],
                subscription_data: {
                    trial_period_days: 7,
                    metadata: {
                        plan_id: planId,
                        plan_name: plan.name
                    }
                },
                success_url: successUrl,
                cancel_url: cancelUrl,
                allow_promotion_codes: true,
                billing_address_collection: 'required',
                customer_update: {
                    address: 'auto',
                    name: 'auto'
                }
            });
            
            return session;
        } catch (error) {
            console.error('Checkout session creation failed:', error);
            throw new Error('Failed to create checkout session');
        }
    }
    
    async cancelSubscription(subscriptionId, immediately = false) {
        try {
            if (immediately) {
                const subscription = await stripe.subscriptions.cancel(subscriptionId);
                return subscription;
            } else {
                // Cancel at period end
                const subscription = await stripe.subscriptions.update(subscriptionId, {
                    cancel_at_period_end: true
                });
                return subscription;
            }
        } catch (error) {
            console.error('Subscription cancellation failed:', error);
            throw new Error('Failed to cancel subscription');
        }
    }
    
    async updateSubscription(subscriptionId, newPlanId) {
        try {
            const plan = this.plans[newPlanId];
            if (!plan) {
                throw new Error('Invalid plan selected');
            }
            
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const price = await this.getOrCreatePrice(plan);
            
            const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
                items: [
                    {
                        id: subscription.items.data[0].id,
                        price: price.id,
                    },
                ],
                proration_behavior: 'create_prorations',
                metadata: {
                    plan_id: newPlanId,
                    plan_name: plan.name
                }
            });
            
            return updatedSubscription;
        } catch (error) {
            console.error('Subscription update failed:', error);
            throw new Error('Failed to update subscription');
        }
    }
    
    async handleWebhook(event) {
        try {
            switch (event.type) {
                case 'customer.subscription.created':
                    await this.handleSubscriptionCreated(event.data.object);
                    break;
                    
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
                    break;
                    
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;
                    
                case 'invoice.payment_succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;
                    
                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
                    
                default:
                    console.log(`Unhandled webhook event type: ${event.type}`);
            }
        } catch (error) {
            console.error('Webhook handling failed:', error);
            throw error;
        }
    }
    
    async handleSubscriptionCreated(subscription) {
        console.log('Subscription created:', subscription.id);
        
        // Update user subscription in database
        const db = require('./database'); // Assuming database module
        await db.updateUserSubscription(
            subscription.customer,
            subscription.id,
            subscription.metadata.plan_id,
            'active',
            subscription.current_period_start,
            subscription.current_period_end
        );
        
        // Send welcome email
        await this.sendWelcomeEmail(subscription.customer);
    }
    
    async handleSubscriptionUpdated(subscription) {
        console.log('Subscription updated:', subscription.id);
        
        const db = require('./database');
        await db.updateUserSubscription(
            subscription.customer,
            subscription.id,
            subscription.metadata.plan_id,
            subscription.status,
            subscription.current_period_start,
            subscription.current_period_end
        );
    }
    
    async handleSubscriptionDeleted(subscription) {
        console.log('Subscription deleted:', subscription.id);
        
        const db = require('./database');
        await db.updateUserSubscription(
            subscription.customer,
            subscription.id,
            'free',
            'canceled',
            null,
            null
        );
        
        // Send cancellation email
        await this.sendCancellationEmail(subscription.customer);
    }
    
    async handlePaymentSucceeded(invoice) {
        console.log('Payment succeeded:', invoice.id);
        
        // Update payment history
        const db = require('./database');
        await db.recordPayment(
            invoice.customer,
            invoice.subscription,
            invoice.amount_paid,
            invoice.currency,
            'succeeded',
            invoice.id
        );
    }
    
    async handlePaymentFailed(invoice) {
        console.log('Payment failed:', invoice.id);
        
        // Record failed payment
        const db = require('./database');
        await db.recordPayment(
            invoice.customer,
            invoice.subscription,
            invoice.amount_due,
            invoice.currency,
            'failed',
            invoice.id
        );
        
        // Send payment failure email
        await this.sendPaymentFailureEmail(invoice.customer);
    }
    
    async getCustomerPortalUrl(customerId, returnUrl) {
        try {
            const session = await stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: returnUrl,
            });
            
            return session.url;
        } catch (error) {
            console.error('Customer portal creation failed:', error);
            throw new Error('Failed to create customer portal');
        }
    }
    
    async getSubscriptionUsage(subscriptionId) {
        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
                expand: ['items.data.price']
            });
            
            // Get usage records if this is a metered subscription
            const usageRecords = await stripe.subscriptionItems.listUsageRecordSummaries(
                subscription.items.data[0].id
            );
            
            return {
                subscription,
                usage: usageRecords.data
            };
        } catch (error) {
            console.error('Usage retrieval failed:', error);
            return null;
        }
    }
    
    async sendWelcomeEmail(customerId) {
        // Implement email sending logic
        console.log(`Sending welcome email to customer: ${customerId}`);
    }
    
    async sendCancellationEmail(customerId) {
        // Implement email sending logic
        console.log(`Sending cancellation email to customer: ${customerId}`);
    }
    
    async sendPaymentFailureEmail(customerId) {
        // Implement email sending logic
        console.log(`Sending payment failure email to customer: ${customerId}`);
    }
    
    getPlans() {
        return this.plans;
    }
    
    getPlan(planId) {
        return this.plans[planId] || null;
    }
    
    calculateProration(currentPlan, newPlan, daysRemaining) {
        const currentDaily = currentPlan.price / 30;
        const newDaily = newPlan.price / 30;
        const refund = currentDaily * daysRemaining;
        const charge = newDaily * daysRemaining;
        
        return {
            refund: Math.round(refund),
            charge: Math.round(charge),
            difference: Math.round(charge - refund)
        };
    }
}

module.exports = PaymentService;