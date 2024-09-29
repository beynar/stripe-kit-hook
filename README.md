# stripe-kit-hook

Simple and elegant abstraction to typesafely handle Stripe webhooks in SvelteKit.
Also add a success callback in conjonction with and idempotency store to prevent duplicate processing.
It's ain't much, but it works.

```ts
import { stripeWebhooks } from 'stripe-kit-hook';
import { sequence } from '@sveltejs/kit/hooks';
import { PRIVATE_STRIPE_SECRET_KEY, PRIVATE_STRIPE_WEBHOOK_SECRET } from '$env/static/private';

export const handle = sequence(
	async ({ event, resolve }) => {
		// run other hooks
		return resolve(event);
	},
	stripeWebhooks({
		secret: PRIVATE_STRIPE_SECRET_KEY,
		webhookSecret: PRIVATE_STRIPE_WEBHOOK_SECRET,
		// Use a fast KV store like Redis, Cloudflare KV, Upstash, etc.
		idempotencyStore: {
			get: async ({ key }) => {
				// Return true if already processed
			},
			set: async ({ key, value }) => {
				// Set the value to true when processed
			}
		},
		handlers: {
			'customer.created': ({ event, data, success }) => {
				console.log('customer.created', data);
				// Call success when done in order to store the idempotency key and prevent duplicate processing
				await success();
			}
		}
	})
);
```
