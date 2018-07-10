const config = require('./config');
const TelegramBot = require('node-telegram-bot-api');
const request = require('request');
const winston = require('winston');
const https = require('https');

if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require('node-localstorage').LocalStorage;
  localStorage = new LocalStorage('./scratch');
}

const logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  transports: [
    new winston.transports.Console({ level: 'info' }),
    new winston.transports.File({
      filename: 'combined.log',
      level: 'debug'
    })
  ]
});

// replace the value below with the Telegram token you receive from @BotFather
const token = config.botToken;

var chatId = "";
var fromId = "";
var message_id = "";

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

var log = function (message) {
  console.log(message);
  logger.info(message, {timestamp: Date.now(), pid: process.pid});
}

var debugLog = function (message) {
  console.log(message);
  logger.debug(message, {timestamp: Date.now(), pid: process.pid});
}

var sendMessage = function(message) {
  bot.sendMessage(chatId, message, { parse_mode: "HTML" });
}

var sendHelp = function() {
  debugLog("Help Command received.. ");
  var helpMessage = "Send a message with /to_work (message) or /to_home (message) to save a message and use /to_work or /to_home to recollect the same message over and over";
  sendMessage(helpMessage);
  deleteMessage();
}

var sendAbout = function() {
  debugLog("About Command received.. ");
  sendMessage("Thanks for using @recollect_bot. \n\n This bot can be used to store and fetch messages for a later recall. \n\n To store messages send /< any_command > <text> \n\n To retrieve send just /<any_command> and the bot will retrieve and post the message back to you/group. \n\n Author @smokinguns");
  deleteMessage();
}

function savePayload(savingCommand, payloadMessage) {
  var key = chatId + "/" + fromId + savingCommand;
  debugLog("Saving payload with key " + key + " and payloadMessage " + payloadMessage);
  localStorage.setItem(key, payloadMessage);
}

function getPayload(savingCommand) {
  var key = chatId + "/" + fromId + savingCommand;
  return localStorage.getItem(key);
}

function getCommand(inputText) {
  if(!inputText || inputText == "") {
    debugLog("Input Text is undefined or blank, defaulting to blank");
    return "";
  }

  // Check if the command is sent out with a payload. If yes, then we fetch the command to process it
  var splitArr = inputText.split(" ");
  if(splitArr.length > 1) {
    var command = splitArr[0];
    debugLog("Input command received is " + command);
    return command;
  }

  // If the command is just sent out without a payload, then the command is sent for processing.
  // This can happen when the payload is already in the database.
  return inputText;
}

function deleteMessage() {
  debugLog("Deleting Message to prevent people from clicking on this");
  bot.deleteMessage(chatId,message_id);
}

function getMessage(inputText) {

  if(!inputText || inputText == "") {
    debugLog("Input Text is undefined or blank, defaulting to blank");
    return "";
  }

  // Check if the command is sent out with a payload. If yes, retrieve and send back
  if(inputText.indexOf(" ") == -1) {
    debugLog("No payload");
    return "";
  }

  var payloadText = inputText.substr(inputText.indexOf(" ")+1, inputText.length);
  debugLog("GetMessage - Payload found - " + payloadText);

  return payloadText;
}

bot.onText(/\/about/, (msg, match) => {
  chatId = msg.chat.id;
  const resp = match[1];
  sendAbout();
});


bot.on('message', (msg) => {

  debugLog('****************** START **********************');

  chatId = msg.chat.id;
  fromId  = msg.from.id;
  message_id = msg.message_id;

  var fromName = msg.from.first_name;
  const messageText = msg.text;

  // sendMessage(JSON.stringify(msg));

  try {
    // debugLog(JSON.stringify(hook.params));

    var command = getCommand(messageText);
    var payload = getMessage(messageText);

    debugLog("Fetched command " + command + " and payload " + payload);

    if((command != "" || command != null) && !command.indexOf('/') == 0) {
      debugLog("Ignore as the command isn't in the required format. Regular message (" + command + ")");
      debugLog('****************** IGNORED END **********************');
      return;
    } else {
      debugLog("All Okay, proceeding to process command");
    }

    debugLog("Received command " + command + " with payload - (" + payload + ")");

    switch(command) {

      case("/to_work") :
      case("/to_work@recollect_bot"):
      debugLog("To work command received with payload " + payload);
      command = "/to_work";
      break;

      case("/to_home") :
      case("/to_home@recollect_bot"):
      debugLog("To home command received with payload " + payload);
      command = "/to_home";
      break;

      case("/help"):
      case("/help@recollect_bot"):
      debugLog("Help command received");
      command = "/help";
      sendHelp();
      return;
      break;

      default :
      debugLog("Custom command " + command + " received with payload " + payload);
      break;
    };

    debugLog("Action commencing");

    // if(command == "/help") {
    //   sendMessage("Thanks for using @recollect_bot. \n\n This bot can be used to store and fetch messages for a later recall. \n\n To store messages send /<any_command> <text> \n\n To retrieve send just /<any_command> and the bot will retrieve and post the message back to you/group. \n\n Author @smokinguns");
    //   return;
    // }

    // TODO, do "in" and "at detection
    if(command != "") {
      debugLog("Command not blank");
      if(payload != "") { // If payload is not blank, then store it and replace the one before.
        debugLog("Payload not blank");
        savePayload(command, payload);
        sendMessage("Registered message");
      } else {
        debugLog("Payload is blank");
        var storedMessage = getPayload(command);
        if(storedMessage == null) {
          debugLog("Nothing saved for this command .. Send Help ");
          sendHelp();
          return;
        }
        sendMessage(fromName + ": " + storedMessage);
      }
    } else {
      debugLog('Command is blank. Will ignore this message as its not meant for the bot');
      debugLog('****************** IGNORED END **********************');
      return;
    }
    deleteMessage();
  } catch(ex) {
    debugLog("ERROR observed while processing this message");
    debugLog("ERROR " + ex.message);
  } finally {
    debugLog('****************** END **********************');
  }
});
