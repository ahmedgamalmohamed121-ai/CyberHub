# 📢 CareerHub Announcements System Guide

This system connects a Telegram Bot to your website and sends Push Notifications via Firebase (FCM).

## 1. Telegram Setup
1.  **Create Bot**: Message [@BotFather](https://t.me/botfather) on Telegram and create a new bot. Copy the **API Token**.
2.  **Get Your Chat ID**: Message [@userinfobot](https://t.me/userinfobot) to get your numerical Chat ID. This ensures only *you* can send announcements.
3.  **Set Webhook**:
    After deploying your server, run this command (replace variables):
    ```bash
    curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_DOMAIN>/telegram-webhook"
    ```

## 2. Firebase Setup (Push Notifications)
1.  Go to [Firebase Console](https://console.firebase.google.com/).
2.  Create a project and add a "Web App".
3.  Copy the `firebaseConfig` object and paste it into **BOTH** `script.js` and `firebase-messaging-sw.js`.
4.  Go to **Project Settings > Cloud Messaging**.
5.  Generate a **Web Push certificate (VAPID Key)**.
6.  Copy the VAPID Key and paste it into `script.js` (replace `YOUR_VAPID_KEY`).
7.  Copy the **Server Key** (Legacy) or setup a Service Account for the backend.
    -   *For this implementation*: Use the Legacy "Server Key" in your `.env` as `FCM_SERVER_KEY`.

## 3. Server Configuration (.env)
Add these to your `.env` file on the server:
```env
TELEGRAM_TOKEN=your_bot_token
ADMIN_CHAT_ID=your_chat_id
FCM_SERVER_KEY=your_firebase_server_key
WEBHOOK_SECRET=a_random_secret_string
DOMAIN=yourwebsite.com
```

## 4. How to Send an Announcement
Just send a message to your Telegram Bot. 
-   The message will appear instantly on the website.
-   A push notification will be sent to everyone who clicked "Enable Notifications".

## 5. Security Notes
-   The system only accepts messages from the `ADMIN_CHAT_ID`.
-   Messages are sanitized before being rendered to prevent XSS.
-   Rate limiting is recommended for production environments.
