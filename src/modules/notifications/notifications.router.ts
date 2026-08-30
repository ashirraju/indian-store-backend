import { Router, Request, Response } from 'express';
import { query } from '../../config/database.js';
import { authGuard } from '../../middlewares/authGuard.js';
import { roleGuard } from '../../middlewares/roleGuard.js';
import { NotificationService } from './notifications.service.js';

export const notificationsRouter = Router();

// Helper to format staff notification row
function formatNotification(row: any) {
  return {
    id: row.id,
    recipientRole: row.recipient_role,
    title: row.title,
    message: row.message,
    type: row.type,
    referenceId: row.reference_id,
    metadata: row.metadata || {},
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

// ==========================================
// 1. LIVE REAL-TIME NOTIFICATIONS STREAM (SSE)
// ==========================================

// GET /api/v1/notifications/stream - Server-Sent Events endpoint for Operations & Staff dashboards
notificationsRouter.get('/stream', (req: Request, res: Response) => {
  const role = (req.query.role as string) || 'Operations';

  // Set SSE HTTP Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  const clientId = NotificationService.registerSseClient(role, res);

  // Keep-alive heartbeat interval every 25 seconds
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': keep-alive ping\n\n');
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, 25000);

  // Handle client connection drop
  req.on('close', () => {
    clearInterval(heartbeatTimer);
    NotificationService.removeSseClient(clientId);
  });
});

// ==========================================
// 2. FETCH STAFF NOTIFICATIONS
// ==========================================

// GET /api/v1/notifications - List staff notifications with filters & pagination
notificationsRouter.get('/', authGuard, async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role || (req.query.role as string) || 'Operations';
    const { unreadOnly, type, page = 1, limit = 20 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    let sql = `
      SELECT * FROM staff_notifications
      WHERE (recipient_role = $1 OR recipient_role = 'All' OR $1 = 'Admin')
    `;
    const params: any[] = [userRole];

    if (unreadOnly === 'true') {
      sql += ' AND is_read = false';
    }

    if (type) {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }

    // Get total count
    const countSql = `SELECT COUNT(*) FROM (${sql}) AS sub`;
    const countRes = await query(countSql, params);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    // Get paginated rows
    params.push(Number(limit));
    params.push(offset);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await query(sql, params);

    // Also get unread count
    const unreadRes = await query(`
      SELECT COUNT(*) FROM staff_notifications 
      WHERE (recipient_role = $1 OR recipient_role = 'All' OR $1 = 'Admin') AND is_read = false
    `, [userRole]);
    const unreadCount = parseInt(unreadRes.rows[0].count, 10);

    res.json({
      success: true,
      data: result.rows.map(formatNotification),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / Number(limit)),
        unreadCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_ERROR', message: error.message });
  }
});

// GET /api/v1/notifications/unread-count - Quick badge counter for navbar
notificationsRouter.get('/unread-count', authGuard, async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role || (req.query.role as string) || 'Operations';

    const unreadRes = await query(`
      SELECT COUNT(*) FROM staff_notifications 
      WHERE (recipient_role = $1 OR recipient_role = 'All' OR $1 = 'Admin') AND is_read = false
    `, [userRole]);

    res.json({
      success: true,
      role: userRole,
      unreadCount: parseInt(unreadRes.rows[0].count, 10),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'FETCH_ERROR', message: error.message });
  }
});

// ==========================================
// 3. READ STATE MANAGEMENT
// ==========================================

// PATCH /api/v1/notifications/:id/read - Mark single notification as read
notificationsRouter.patch('/:id/read', authGuard, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(`
      UPDATE staff_notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE id::text = $1
      RETURNING *
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Notification not found.' });
    }

    res.json({
      success: true,
      message: 'Notification marked as read.',
      data: formatNotification(result.rows[0]),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'UPDATE_FAILED', message: error.message });
  }
});

// POST /api/v1/notifications/mark-all-read - Mark all notifications as read for role
notificationsRouter.post('/mark-all-read', authGuard, async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role || req.body.role || 'Operations';

    const result = await query(`
      UPDATE staff_notifications 
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE (recipient_role = $1 OR recipient_role = 'All' OR $1 = 'Admin') AND is_read = false
      RETURNING id
    `, [userRole]);

    res.json({
      success: true,
      message: `Marked ${result.rowCount} notifications as read.`,
      updatedCount: result.rowCount,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'UPDATE_FAILED', message: error.message });
  }
});

// ==========================================
// 4. MANUAL BROADCAST DISPATCH (MANAGER / ADMIN)
// ==========================================

// POST /api/v1/notifications/broadcast - Send custom notification to Operations team
notificationsRouter.post('/broadcast', authGuard, roleGuard('Manager', 'Admin'), async (req: Request, res: Response) => {
  try {
    const { recipientRole = 'Operations', title, message, type = 'URGENT_SLA', referenceId, metadata } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Title and message are required.' });
    }

    const created = await NotificationService.createStaffNotification({
      recipientRole,
      title,
      message,
      type,
      referenceId,
      metadata,
    });

    if (created) {
      NotificationService.broadcastToStaff(recipientRole, created);
    }

    res.status(201).json({
      success: true,
      message: `Notification broadcasted to ${recipientRole} team.`,
      data: formatNotification(created),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'BROADCAST_FAILED', message: error.message });
  }
});
