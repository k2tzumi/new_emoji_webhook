import { OAuth2Handler } from "./OAuth2Handler";
import { JobBroker } from "./JobBroker"
import { SlackWebhooks } from "./SlackWebhooks";
import { CallbackEventHandler } from "./CallbackEventHandler";
import { Slack } from "./slack/types/callback-events.d";
import { DuplicateEventError } from "./CallbackEventHandler";

type TextOutput = GoogleAppsScript.Content.TextOutput
type HtmlOutput = GoogleAppsScript.HTML.HtmlOutput;
type EmojiChangedEvent = Slack.CallbackEvent.EmojiChangedEvent;

const properties = PropertiesService.getScriptProperties();

const CLIENT_ID: string = properties.getProperty("CLIENT_ID");
const CLIENT_SECRET: string = properties.getProperty("CLIENT_SECRET");
let handler: OAuth2Handler;

const handleCallback = function (request): HtmlOutput {
  return handler.authCallback(request);
}

handler = new OAuth2Handler(CLIENT_ID, CLIENT_SECRET, PropertiesService.getUserProperties(), handleCallback.name);

/**
 * Authorizes and makes a request to the Slack API.
 */
function doGet(request): HtmlOutput {
  // Clear authentication by accessing with the get parameter `?logout=true`
  if (request.parameter.logout) {
    handler.clearService();
    const template = HtmlService.createTemplate('Logout<br /><a href="<?= requestUrl ?>" target="_blank">refresh</a>.');
    template.requestUrl = getRequestURL();
    return HtmlService.createHtmlOutput(template.evaluate());
  }

  if (handler.verifyAccessToken()) {
    return HtmlService.createHtmlOutput('OK');
  } else {
    const template = HtmlService.createTemplate('RedirectUri:<?= redirectUrl ?> <br /><a href="<?= authorizationUrl ?>" target="_blank">Authorize</a>.');
    template.authorizationUrl = handler.authorizationUrl;
    template.redirectUrl = handler.redirectUri;
    return HtmlService.createHtmlOutput(template.evaluate());
  }
}

function getRequestURL() {
  const serviceURL = ScriptApp.getService().getUrl();
  return serviceURL.replace('/dev', '/exec');
}

const asyncLogging = function (): void {
  const jobBroker: JobBroker = new JobBroker();
  jobBroker.consumeJob((parameter: {}) => {
    console.info(JSON.stringify(parameter));
  });
}

const VERIFICATION_TOKEN: string = properties.getProperty('VERIFICATION_TOKEN');

function doPost(e): TextOutput {
  const eventHandler = new CallbackEventHandler(VERIFICATION_TOKEN);

  eventHandler.addListener('emoji_changed', executeEmojiChangedEvent);

  try {
    const process = eventHandler.handle(e);

    if (process.performed) {
      return process.output;
    }
  } catch (exception) {
    if (exception instanceof DuplicateEventError) {
      return ContentService.createTextOutput();
    } else {
      new JobBroker().enqueue(asyncLogging, { message: exception.message, stack: exception.stack });
      throw exception;
    }
  }

  throw new Error(`No performed handler, request: ${JSON.stringify(e)}`);
}

const NOTIFICATION_MESSAGE: string = properties.getProperty('NOTIFICATION_MESSAGE') || 'A new emoji is added'

const executeEmojiChangedEvent = function (event: EmojiChangedEvent): void {
  const { subtype, name, value } = event;

  if (subtype === 'add') {
    let message = `${NOTIFICATION_MESSAGE} :${name}: \`:${name}:\``

    if (value.indexOf('alias:') === 0) {
      const origin_emoji = value.replace(/^alias:/, '')
      message += ` (alias of \`:${origin_emoji}:\`)`
    }

    const webhook = new SlackWebhooks(handler.incomingWebhookUrl);
    if (!webhook.invoke(message)) {
      throw new Error(`Sending messages faild. event: ${JSON.stringify(event)}`);
    }
  }
}
