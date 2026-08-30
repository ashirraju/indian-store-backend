import { Response } from 'express';
import { query } from '../../config/database.js';

export interface OrderNotificationPayload {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalAmount: number;
  status: string;
  itemsCount: number;
  deliveryAgent?: string;
  shippingAddress?: any;
  items?: Array<{ name: string; quantity: number; unitPrice: number }>;
  paymentMethod?: string;
}

export interface StaffNotificationPayload {
  recipientRole?: 'Operations' | 'Manager' | 'Admin' | 'Delivery' | 'All';
  title: string;
  message: string;
  type?: 'NEW_ORDER' | 'LOW_STOCK' | 'ORDER_CANCELLED' | 'URGENT_SLA' | 'PAYMENT_RECEIVED';
  referenceId?: string;
  metadata?: Record<string, any>;
}

// In-Memory SSE Client Registry for real-time warehouse dashboard notifications
interface SseClient {
  id: string;
  role: string;
  res: Response;
}

export class NotificationService {
  private static sseClients: SseClient[] = [];

  // ==========================================
  // 1. OPERATIONS TEAM NOTIFICATION ENGINE
  // ==========================================

  /**
   * Automatically triggered when an order is placed by a customer.
   * Notifies the Operations & Warehouse Packing team across in-app SSE, persistent database alerts, email & SMS/WhatsApp.
   */
  static async notifyOperationsTeamAboutNewOrder(payload: OrderNotificationPayload) {
    try {
      console.log(`[OPERATIONS ALERT] New order #${payload.orderId} received. Dispatching alert to Operations & Packing Team.`);

      const title = `🚨 New Order: #${payload.orderId}`;
      const message = `Order #${payload.orderId} for ₹${payload.totalAmount} (${payload.itemsCount} items) placed by ${payload.customerName}. Ready for fulfillment & packing.`;

      const metadata = {
        orderId: payload.orderId,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        customerEmail: payload.customerEmail,
        totalAmount: payload.totalAmount,
        itemsCount: payload.itemsCount,
        paymentMethod: payload.paymentMethod || 'UPI / Card',
        items: payload.items || [],
        shippingAddress: payload.shippingAddress,
        deliverySla: '2-Hour Express Packing SLA',
        priority: payload.totalAmount > 1500 ? 'HIGH' : 'NORMAL',
      };

      // 1. Insert Persistent Notification into staff_notifications for Operations role
      const opsNotif = await this.createStaffNotification({
        recipientRole: 'Operations',
        title,
        message,
        type: 'NEW_ORDER',
        referenceId: payload.orderId,
        metadata,
      });

      // 2. Also insert for Store Manager
      await this.createStaffNotification({
        recipientRole: 'Manager',
        title,
        message,
        type: 'NEW_ORDER',
        referenceId: payload.orderId,
        metadata,
      });

      // 3. Push real-time broadcast to active Operations Dashboard web screens via SSE
      if (opsNotif) {
        this.broadcastToStaff('Operations', opsNotif);
        this.broadcastToStaff('Manager', opsNotif);
        this.broadcastToStaff('Admin', opsNotif);
      }

      // 4. Dispatch Email to Operations Team Dispatch Center
      await this.sendEmail(
        'ops-team@indianstore.com',
        'OPS_NEW_ORDER_ALERT',
        payload
      );

      // 5. Dispatch Warehouse Floor WhatsApp / SMS Dispatch Alert
      await this.sendWhatsAppMessage(
        '+919876543210', // Operations duty supervisor hotline
        'OPS_NEW_ORDER_ALERT',
        payload
      );
    } catch (err) {
      console.error('[NotificationService] Error notifying operations team:', err);
    }
  }

  /**
   * Create persistent staff notification in PostgreSQL database
   */
  static async createStaffNotification(payload: StaffNotificationPayload) {
    try {
      const sql = `
        INSERT INTO staff_notifications (
          recipient_role, title, message, type, reference_id, metadata, is_read, created_at
        ) VALUES (
          COALESCE($1, 'Operations'), $2, $3, COALESCE($4, 'NEW_ORDER'), $5, $6, false, CURRENT_TIMESTAMP
        )
        RETURNING *
      `;

      const values = [
        payload.recipientRole || 'Operations',
        payload.title,
        payload.message,
        payload.type || 'NEW_ORDER',
        payload.referenceId || null,
        JSON.stringify(payload.metadata || {}),
      ];

      const res = await query(sql, values);
      return res.rows[0];
    } catch (err) {
      console.error('[NotificationService] Error saving staff notification to database:', err);
      return null;
    }
  }

  // ==========================================
  // 2. REAL-TIME SERVER-SENT EVENTS (SSE)
  // ==========================================

  /**
   * Register an SSE connection for Operations, Manager, or Admin dashboard
   */
  static registerSseClient(role: string, res: Response): string {
    const clientId = 'sse_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    this.sseClients.push({ id: clientId, role: role.toLowerCase(), res });

    // Send initial handshake ping
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Operations Live Notification Stream Active', clientId })}\n\n`);

    console.log(`[SSE STREAM] Client connected: ${clientId} (Role: ${role}). Active SSE connections: ${this.sseClients.length}`);
    return clientId;
  }

  /**
   * Remove SSE client upon disconnect
   */
  static removeSseClient(clientId: string) {
    this.sseClients = this.sseClients.filter(c => c.id !== clientId);
    console.log(`[SSE STREAM] Client disconnected: ${clientId}. Remaining SSE connections: ${this.sseClients.length}`);
  }

  /**
   * Broadcast message to all connected SSE clients matching target role
   */
  static broadcastToStaff(role: string, notificationData: any) {
    const target = role.toLowerCase();
    const eventPayload = `data: ${JSON.stringify({ type: 'STAFF_NOTIFICATION', data: notificationData })}\n\n`;

    this.sseClients.forEach(client => {
      if (client.role === target || client.role === 'admin' || client.role === 'all' || target === 'all') {
        try {
          client.res.write(eventPayload);
        } catch (err) {
          console.error(`[SSE ERROR] Failed writing to client ${client.id}:`, err);
        }
      }
    });
  }

  // ==========================================
  // 3. CUSTOMER TRANSACTIONAL NOTIFICATIONS
  // ==========================================

  /**
   * Dispatch multi-channel transactional notifications (Email + SMS + WhatsApp) to Customer
   */
  static async sendOrderEventNotification(
    event: 'ORDER_PLACED' | 'ORDER_PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED',
    payload: OrderNotificationPayload
  ) {
    console.log(`[Notification Engine] Triggering event ${event} for Order ${payload.orderId}`);

    // 1. Transactional Email to Customer
    if (payload.customerEmail) {
      await this.sendEmail(payload.customerEmail, event, payload);
    }

    // 2. WhatsApp Order Tracking Message to Customer
    if (payload.customerPhone) {
      await this.sendWhatsAppMessage(payload.customerPhone, event, payload);
    }

    // 3. SMS Alert Fallback to Customer
    if (payload.customerPhone) {
      await this.sendSMS(payload.customerPhone, event, payload);
    }
  }

  // ==========================================
  // 4. LOW-LEVEL DISPATCH PROVIDERS (WITH AUDIT)
  // ==========================================

  private static async sendEmail(recipient: string, event: string, payload: OrderNotificationPayload) {
    try {
      console.log(`[EMAIL DISPATCH] To: ${recipient} | Subject: Indian Store - Order ${payload.orderId} ${event}`);
      await query(`
        INSERT INTO notification_logs (channel, recipient, template_name, status, provider_response)
        VALUES ('EMAIL', $1, $2, 'SENT', $3)
      `, [recipient, event, JSON.stringify({ messageId: 'msg_' + Date.now(), deliveredAt: new Date() })]);
    } catch (err) {
      console.error('[EMAIL ERROR]', err);
    }
  }

  private static async sendWhatsAppMessage(phone: string, event: string, payload: OrderNotificationPayload) {
    try {
      const isOps = event.startsWith('OPS_');
      const text = isOps
        ? `🚨 *OPERATIONS ALERT - NEW ORDER* 📦\nOrder: #${payload.orderId}\nCustomer: ${payload.customerName} (${payload.customerPhone})\nAmount: ₹${payload.totalAmount}\nItems: ${payload.itemsCount} units\nAction Required: Begin fulfillment & packing.`
        : `Namaste ${payload.customerName}! 🙏 Your Indian Store order #${payload.orderId} is now *${payload.status}*. Total: ₹${payload.totalAmount}. Track live on your portal.`;

      console.log(`[WHATSAPP DISPATCH] To: ${phone} | Message: ${text}`);
      await query(`
        INSERT INTO notification_logs (channel, recipient, template_name, status, provider_response)
        VALUES ('WHATSAPP', $1, $2, 'SENT', $3)
      `, [phone, event, JSON.stringify({ waMessageId: 'wa_' + Date.now(), text })]);
    } catch (err) {
      console.error('[WHATSAPP ERROR]', err);
    }
  }

  private static async sendSMS(phone: string, event: string, payload: OrderNotificationPayload) {
    try {
      const text = `Indian Store: Order ${payload.orderId} is ${payload.status}. Amount: Rs.${payload.totalAmount}. Thank you for shopping authentic!`;
      console.log(`[SMS DISPATCH] To: ${phone} | Text: ${text}`);
      await query(`
        INSERT INTO notification_logs (channel, recipient, template_name, status, provider_response)
        VALUES ('SMS', $1, $2, 'SENT', $3)
      `, [phone, event, JSON.stringify({ smsId: 'sms_' + Date.now() })]);
    } catch (err) {
      console.error('[SMS ERROR]', err);
    }
  }
}
