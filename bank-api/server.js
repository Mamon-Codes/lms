const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Generate random account number
function generateAccountNumber() {
    const prefix = 'ACC';
    const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    return `${prefix}-${random}`;
}

// =====================================================
// ENDPOINTS
// =====================================================

// Create new bank account
app.post('/api/create-account', async (req, res) => {
    try {
        const { secret, initialBalance = 1000 } = req.body;

        if (!secret) {
            return res.status(400).json({ error: 'Secret is required' });
        }

        // Hash the secret
        const hashedSecret = await bcrypt.hash(secret, 10);

        // Generate unique account number
        const accountNumber = generateAccountNumber();

        // Insert account
        await db.query(
            'INSERT INTO accounts (account_number, secret, balance) VALUES (?, ?, ?)',
            [accountNumber, hashedSecret, initialBalance]
        );

        res.json({
            success: true,
            accountNumber,
            balance: initialBalance
        });
    } catch (error) {
        console.error('Create account error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// Get account balance
app.get('/api/balance/:accountNumber', async (req, res) => {
    try {
        const { accountNumber } = req.params;

        const [rows] = await db.query(
            'SELECT balance FROM accounts WHERE account_number = ?',
            [accountNumber]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Account not found' });
        }

        res.json({
            success: true,
            accountNumber,
            balance: rows[0].balance
        });
    } catch (error) {
        console.error('Balance check error:', error);
        res.status(500).json({ error: 'Failed to check balance' });
    }
});

// Transfer money between accounts
app.post('/api/transfer', async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { fromAccount, toAccount, amount, secret, description = '' } = req.body;

        if (!fromAccount || !toAccount || !amount || !secret) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be positive' });
        }

        await connection.beginTransaction();

        // Verify sender account and secret
        const [senderRows] = await connection.query(
            'SELECT secret, balance FROM accounts WHERE account_number = ?',
            [fromAccount]
        );

        if (senderRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Sender account not found' });
        }

        // Verify secret
        const secretMatch = await bcrypt.compare(secret, senderRows[0].secret);
        if (!secretMatch) {
            await connection.rollback();
            return res.status(401).json({ error: 'Invalid secret' });
        }

        // Check balance
        if (senderRows[0].balance < amount) {
            await connection.rollback();
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Verify receiver account exists
        const [receiverRows] = await connection.query(
            'SELECT account_number FROM accounts WHERE account_number = ?',
            [toAccount]
        );

        if (receiverRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Receiver account not found' });
        }

        // Deduct from sender
        await connection.query(
            'UPDATE accounts SET balance = balance - ? WHERE account_number = ?',
            [amount, fromAccount]
        );

        // Add to receiver
        await connection.query(
            'UPDATE accounts SET balance = balance + ? WHERE account_number = ?',
            [amount, toAccount]
        );

        // Create transaction record
        const [result] = await connection.query(
            'INSERT INTO transactions (from_account, to_account, amount, description, status, validated_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [fromAccount, toAccount, amount, description, 'completed']
        );

        await connection.commit();

        res.json({
            success: true,
            transactionId: result.insertId,
            message: 'Transfer successful'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Transfer error:', error);
        res.status(500).json({ error: 'Transfer failed' });
    } finally {
        connection.release();
    }
});

// Create transaction record (for instructor payment)
app.post('/api/transaction-record', async (req, res) => {
    try {
        const { fromAccount, toAccount, amount, description = '' } = req.body;

        if (!fromAccount || !toAccount || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify both accounts exist
        const [fromRows] = await db.query(
            'SELECT account_number FROM accounts WHERE account_number = ?',
            [fromAccount]
        );

        const [toRows] = await db.query(
            'SELECT account_number FROM accounts WHERE account_number = ?',
            [toAccount]
        );

        if (fromRows.length === 0 || toRows.length === 0) {
            return res.status(404).json({ error: 'One or both accounts not found' });
        }

        // Create pending transaction
        const [result] = await db.query(
            'INSERT INTO transactions (from_account, to_account, amount, description, status) VALUES (?, ?, ?, ?, ?)',
            [fromAccount, toAccount, amount, description, 'pending']
        );

        res.json({
            success: true,
            transactionId: result.insertId,
            message: 'Transaction record created'
        });
    } catch (error) {
        console.error('Transaction record error:', error);
        res.status(500).json({ error: 'Failed to create transaction record' });
    }
});

// Validate and execute pending transaction
app.post('/api/validate-transaction', async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { transactionId, toAccountSecret } = req.body;

        if (!transactionId || !toAccountSecret) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        await connection.beginTransaction();

        // Get transaction details
        const [txRows] = await connection.query(
            'SELECT * FROM transactions WHERE id = ? AND status = ?',
            [transactionId, 'pending']
        );

        if (txRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Transaction not found or already processed' });
        }

        const tx = txRows[0];

        // Verify receiver account and secret
        const [receiverRows] = await connection.query(
            'SELECT secret, balance FROM accounts WHERE account_number = ?',
            [tx.to_account]
        );

        if (receiverRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Receiver account not found' });
        }

        // Verify secret
        const secretMatch = await bcrypt.compare(toAccountSecret, receiverRows[0].secret);
        if (!secretMatch) {
            await connection.rollback();
            return res.status(401).json({ error: 'Invalid secret' });
        }

        // Check sender balance
        const [senderRows] = await connection.query(
            'SELECT balance FROM accounts WHERE account_number = ?',
            [tx.from_account]
        );

        if (senderRows.length === 0 || senderRows[0].balance < tx.amount) {
            await connection.rollback();
            return res.status(400).json({ error: 'Insufficient balance in sender account' });
        }

        // Execute transfer
        await connection.query(
            'UPDATE accounts SET balance = balance - ? WHERE account_number = ?',
            [tx.amount, tx.from_account]
        );

        await connection.query(
            'UPDATE accounts SET balance = balance + ? WHERE account_number = ?',
            [tx.amount, tx.to_account]
        );

        // Update transaction status
        await connection.query(
            'UPDATE transactions SET status = ?, validated_at = NOW() WHERE id = ?',
            ['completed', transactionId]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Transaction validated and completed',
            amount: tx.amount
        });
    } catch (error) {
        await connection.rollback();
        console.error('Validation error:', error);
        res.status(500).json({ error: 'Transaction validation failed' });
    } finally {
        connection.release();
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'Bank API is running', port: PORT });
});

// Start server
app.listen(PORT, () => {
    console.log(`🏦 Bank API running on http://localhost:${PORT}`);
});
