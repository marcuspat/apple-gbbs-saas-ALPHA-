// Message Board Routes
const express = require('express');

class BoardRoutes {
    constructor(db, authMiddleware) {
        this.db = db;
        this.authMiddleware = authMiddleware;
        this.router = express.Router();
        this.setupRoutes();
    }

    setupRoutes() {
        this.router.get('/', this.getBoards.bind(this));
        this.router.get('/:id/messages', this.getMessages.bind(this));
        this.router.post('/:id/messages', this.authMiddleware.authenticate(), this.postMessage.bind(this));
    }

    getBoards(req, res) {
        const query = `SELECT b.*, COUNT(m.id) as message_count,
                MAX(m.created_at) as last_post
                FROM boards b
                LEFT JOIN messages m ON b.id = m.board_id
                WHERE b.is_active = 1
                GROUP BY b.id
                ORDER BY b.id`;

        this.db.all(query, (err, boards) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Server error' });
            }
            res.json(boards);
        });
    }

    getMessages(req, res) {
        const boardId = req.params.id;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Cap at 100
        const offset = parseInt(req.query.offset) || 0;
        
        if (!boardId || isNaN(boardId)) {
            return res.status(400).json({ message: 'Invalid board ID' });
        }

        const query = `SELECT m.*, u.username
                FROM messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.board_id = ?
                ORDER BY m.created_at DESC
                LIMIT ? OFFSET ?`;

        this.db.all(query, [boardId, limit, offset], (err, messages) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Server error' });
            }
            res.json(messages);
        });
    }

    postMessage(req, res) {
        const { subject, content } = req.body;
        const boardId = req.params.id;
        
        if (!subject || !content) {
            return res.status(400).json({ message: 'Subject and content required' });
        }

        if (!boardId || isNaN(boardId)) {
            return res.status(400).json({ message: 'Invalid board ID' });
        }

        // Validate content length
        if (subject.length > 200) {
            return res.status(400).json({ message: 'Subject too long (max 200 characters)' });
        }

        if (content.length > 10000) {
            return res.status(400).json({ message: 'Content too long (max 10000 characters)' });
        }

        const query = `INSERT INTO messages (board_id, user_id, subject, content) VALUES (?, ?, ?, ?)`;
        
        this.db.run(query, [boardId, req.user.id, subject, content], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Failed to post message' });
            }
            res.json({ 
                message: 'Message posted successfully', 
                id: this.lastID,
                boardId: parseInt(boardId)
            });
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = BoardRoutes;