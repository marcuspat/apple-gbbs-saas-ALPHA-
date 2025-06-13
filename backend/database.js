const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'retrobbs.db'));
    }
    
    async updateUserSubscription(customerId, subscriptionId, planId, status, periodStart, periodEnd) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR REPLACE INTO subscriptions (
                    user_id, stripe_subscription_id, plan_id, status, 
                    current_period_start, current_period_end
                ) 
                SELECT id, ?, ?, ?, ?, ?
                FROM users 
                WHERE stripe_customer_id = ?
            `, [subscriptionId, planId, status, periodStart, periodEnd, customerId], 
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }
    
    async recordPayment(customerId, subscriptionId, amount, currency, status, invoiceId) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO payments (
                    user_id, subscription_id, amount, currency, status, 
                    stripe_invoice_id, created_at
                )
                SELECT u.id, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
                FROM users u
                WHERE u.stripe_customer_id = ?
            `, [subscriptionId, amount, currency, status, invoiceId, customerId],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }
    
    async getUserByStripeCustomerId(customerId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM users WHERE stripe_customer_id = ?
            `, [customerId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
    
    async updateUserPlan(userId, planId) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE users SET subscription_tier = ? WHERE id = ?
            `, [planId, userId], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
    }
}

module.exports = new Database();</content>
</invoke>