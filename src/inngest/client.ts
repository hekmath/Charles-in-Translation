import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'json-translator',
  name: 'JSON Translator App',
  env: process.env.NEXT_PUBLIC_ENVIRONMENT,
});
