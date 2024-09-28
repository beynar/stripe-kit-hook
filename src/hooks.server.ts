import { stripeWebhooks } from '$lib/index.js';
import { sequence } from '@sveltejs/kit/hooks';
import { PRIVATE_STRIPE_SECRET_KEY, PRIVATE_STRIPE_WEBHOOK_SECRET } from '$env/static/private';
let idempotencyStore = new Map<string, boolean>();
console.log({ PRIVATE_STRIPE_SECRET_KEY, PRIVATE_STRIPE_WEBHOOK_SECRET });
export const handle = sequence(
	async ({ event, resolve }) => {
		// run other hooks
		return resolve(event);
	},
	stripeWebhooks({
		secret: PRIVATE_STRIPE_SECRET_KEY,
		webhookSecret: PRIVATE_STRIPE_WEBHOOK_SECRET,
		idempotencyStore: {
			get: async ({ key }) => {
				return idempotencyStore.get(key);
			},
			set: async ({ key, value }) => {
				idempotencyStore.set(key, value);
			}
		},
		path: '/stripe-webhooks',
		handlers: {
			'customer.created': ({ event, data, success }) => {
				console.log('customer.created', data);
				success();
			}
		}
	})
);
