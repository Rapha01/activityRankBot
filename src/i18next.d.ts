import 'i18next';
import commands from '../locales/en-US/commands.json';
import content from '../locales/en-US/content.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      commands: typeof commands;
      content: typeof content;
    };
  }
}
