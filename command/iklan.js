const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
import execute from '../lib/execute.js';
export const cmds = ["iklan"];
export const exec = async (bot, msg, chatId, messageId) => {
        showMainMenu(chatId);
};

// Store group IDs, settings, and message templates
let groups = [];
let settings = {
    morningTime: '0 8 * * *', // 8 AM
    eveningTime: '0 20 * * *', // 8 PM
};
let messageTemplates = [];
let manualSchedules = {}; // Store manual schedules

// Function to send a message to all groups
function broadcastMessage(message) {
    groups.forEach(chatId => {
        bot.sendMessage(chatId, message)
            .then(() => console.log(`Message sent to ${chatId}: ${message}`))
            .catch(err => console.error(`Error sending message to ${chatId}:`, err));
    });
}

// Schedule automatic messages using cron
function scheduleMessages() {
    cron.getTasks().forEach(task => task.stop()); // Stop existing cron jobs
    cron.schedule(settings.morningTime, () => {
        const morningTemplate = messageTemplates.find(t => t.name === 'morning');
        if (morningTemplate) {
            broadcastMessage(morningTemplate.text);
        }
    });
    cron.schedule(settings.eveningTime, () => {
        const eveningTemplate = messageTemplates.find(t => t.name === 'evening');
        if (eveningTemplate) {
            broadcastMessage(eveningTemplate.text);
        }
    });
}

// Function to show the main menu with inline buttons
function showMainMenu(chatId) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Add Group', callback_data: 'add_group' }],
                [{ text: 'View Groups', callback_data: 'view_groups' }],
                [{ text: 'Delete Group', callback_data: 'delete_group' }],
                [{ text: 'Manage Templates', callback_data: 'manage_templates' }],
                [{ text: 'Set Morning Time', callback_data: 'set_morning_time' }],
                [{ text: 'Set Evening Time', callback_data: 'set_evening_time' }],
                [{ text: 'Send Message Manually', callback_data: 'send_manual' }],
            ],
        },
    };
    bot.sendMessage(chatId, 'Main Menu:', options);
}

// Handle inline button callbacks
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'add_group') {
        bot.sendMessage(chatId, 'Please add the bot to the group and send /addgroup here.');
    } else if (data === 'view_groups') {
        const groupList = groups.length > 0 ? groups.join('\n') : 'No groups added yet.';
        bot.sendMessage(chatId, `Groups:\n${groupList}`);
    } else if (data === 'delete_group') {
        if (groups.length === 0) {
            bot.sendMessage(chatId, 'No groups to delete.');
        } else {
            const groupButtons = groups.map(group => [{ text: `Delete Group ${group}`, callback_data: `deletegroup_${group}` }]);
            bot.sendMessage(chatId, 'Select a group to delete:', {
                reply_markup: {
                    inline_keyboard: groupButtons,
                },
            });
        }
    } else if (data.startsWith('deletegroup_')) {
        const groupId = data.split('_')[1];
        groups = groups.filter(group => group !== groupId);
        bot.sendMessage(chatId, `Group ${groupId} has been deleted.`);
    } else if (data === 'manage_templates') {
        showTemplateMenu(chatId);
    } else if (data === 'set_morning_time') {
        bot.sendMessage(chatId, 'Please send the new morning time in cron format (e.g., "0 8 * * *" for 8 AM):');
        bot.once('message', (msg) => {
            settings.morningTime = msg.text;
            scheduleMessages();
            bot.sendMessage(chatId, 'Morning time updated!');
        });
    } else if (data === 'set_evening_time') {
        bot.sendMessage(chatId, 'Please send the new evening time in cron format (e.g., "0 20 * * *" for 8 PM):');
        bot.once('message', (msg) => {
            settings.eveningTime = msg.text;
            scheduleMessages();
            bot.sendMessage(chatId, 'Evening time updated!');
        });
    } else if (data === 'send_manual') {
        bot.sendMessage(chatId, 'Please select a template to send:', {
            reply_markup: {
                inline_keyboard: messageTemplates.map(t => [
                    { text: t.name, callback_data: `manual_${t.name}` },
                ]),
            },
        });
    } else if (data.startsWith('manual_')) {
        const templateName = data.split('_')[1];
        const template = messageTemplates.find(t => t.name === templateName);
        if (template) {
            bot.sendMessage(chatId, `You selected "${templateName}". Please send the time in HH:MM format (e.g., "14:30" for 2:30 PM):`);
            bot.once('message', (msg) => {
                const time = msg.text.trim();
                if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
                    const [hour, minute] = time.split(':');
                    const cronTime = `${minute} ${hour} * * *`; // Convert to cron format
                    manualSchedules[templateName] = cron.schedule(cronTime, () => {
                        broadcastMessage(template.text);
                    });
                    bot.sendMessage(chatId, `Message "${templateName}" will be sent at ${time}.`);
                } else {
                    bot.sendMessage(chatId, 'Invalid time format. Please use HH:MM (e.g., "14:30").');
                }
            });
        }
    } else if (data.startsWith('template_')) {
        const templateName = data.split('_')[1];
        const template = messageTemplates.find(t => t.name === templateName);
        if (template) {
            bot.sendMessage(chatId, `Current template for ${templateName}:\n${template.text}\n\nPlease send the new text:`);
            bot.once('message', (msg) => {
                template.text = msg.text;
                bot.sendMessage(chatId, `Template "${templateName}" updated!`);
            });
        }
    } else if (data.startsWith('delete_')) {
        const templateName = data.split('_')[1];
        messageTemplates = messageTemplates.filter(t => t.name !== templateName);
        bot.sendMessage(chatId, `Template "${templateName}" deleted!`);
    }
});

// Function to show the template management menu
function showTemplateMenu(chatId) {
    const templateButtons = messageTemplates.map(t => [
        { text: `Edit ${t.name}`, callback_data: `template_${t.name}` },
        { text: `Delete ${t.name}`, callback_data: `delete_${t.name}` },
    ]);
    const options = {
        reply_markup: {
            inline_keyboard: [
                ...templateButtons,
                [{ text: 'Add New Template', callback_data: 'add_template' }],
                [{ text: 'View Templates', callback_data: 'view_templates' }],
            ],
        },
    };
    bot.sendMessage(chatId, 'Template Management:', options);
}

// Command to add a group
bot.onText(/\/addgroup/, (msg) => {
    const chatId = msg.chat.id;
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
        if (!groups.includes(chatId)) {
            groups.push(chatId);
            bot.sendMessage(chatId, 'Group added successfully!');
        } else {
            bot.sendMessage(chatId, 'Group already exists in the list.');
        }
    } else {
        bot.sendMessage(chatId, 'This command can only be used in a group.');
    }
});

// Handle adding new templates
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    if (data === 'add_template') {
        bot.sendMessage(chatId, 'Please send the template name:');
        bot.once('message', (msg) => {
            const templateName = msg.text;
            bot.sendMessage(chatId, 'Please send the template text:');
            bot.once('message', (msg) => {
                messageTemplates.push({ name: templateName, text: msg.text });
                bot.sendMessage(chatId, `Template "${templateName}" added!`);
            });
        });
    } else if (data === 'view_templates') {
        const templateList = messageTemplates.map(t => `${t.name}: ${t.text}`).join('\n\n');
        bot.sendMessage(chatId, `Templates:\n\n${templateList}`);
    }
});

console.log('Bot is running...');