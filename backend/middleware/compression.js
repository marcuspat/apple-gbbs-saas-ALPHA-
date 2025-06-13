// Compression and Performance Middleware
const compression = require('compression');

class CompressionMiddleware {
    static create() {
        return compression({
            // Only compress responses if they're bigger than 1kb
            threshold: 1024,
            
            // Set compression level (1-9, 6 is default)
            level: 6,
            
            // Only compress certain content types
            filter: (req, res) => {
                // Don't compress already compressed content
                if (req.headers['x-no-compression']) {
                    return false;
                }
                
                // Fallback to standard filter function
                return compression.filter(req, res);
            },
            
            // Custom compression settings
            windowBits: 15,
            memLevel: 8
        });
    }

    static createCustom(options = {}) {
        const defaultOptions = {
            threshold: options.threshold || 1024,
            level: options.level || 6,
            chunkSize: options.chunkSize || 16384,
            windowBits: options.windowBits || 15,
            memLevel: options.memLevel || 8
        };

        return compression(defaultOptions);
    }

    // Selective compression based on content type
    static createSelective() {
        return compression({
            filter: (req, res) => {
                const contentType = res.getHeader('content-type');
                
                // Always compress text-based content
                if (contentType && (
                    contentType.includes('text/') ||
                    contentType.includes('application/json') ||
                    contentType.includes('application/javascript') ||
                    contentType.includes('text/css')
                )) {
                    return true;
                }
                
                // Don't compress images, audio, video
                if (contentType && (
                    contentType.includes('image/') ||
                    contentType.includes('audio/') ||
                    contentType.includes('video/')
                )) {
                    return false;
                }
                
                return compression.filter(req, res);
            }
        });
    }
}

module.exports = CompressionMiddleware;