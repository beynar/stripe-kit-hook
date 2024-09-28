import Stripe from 'stripe';
import { DEV } from 'esm-env';
import { type Handle, type RequestEvent } from '@sveltejs/kit';

type MaybePromise<T> = T | Promise<T>;
type EventType = Stripe.Event.Type;
type Event = Stripe.Event;
type PickFromUnion<T extends Event, K extends T['type']> = Extract<T, { type: K }>;
type EventHandlers = {
	[K in EventType]?: ({
		event,
		data
	}: {
		event: RequestEvent;
		data: PickFromUnion<Event, K>;
		success: () => MaybePromise<void>;
	}) => MaybePromise<void>;
};

type StripeWebhooksParams = {
	secret: string;
	webhookSecret: string;
	path?: `/${string}`;
	onFailure?: (error: unknown, payload: Event) => MaybePromise<void>;
	handlers: EventHandlers;
	idempotencyStore?: {
		get(payload: { event: RequestEvent; key: string }): MaybePromise<boolean | undefined | null>;
		set(payload: { event: RequestEvent; key: string; value: boolean }): MaybePromise<void>;
	};
};

export const stripeWebhooks =
	({
		secret,
		webhookSecret,
		onFailure,
		idempotencyStore,
		path = '/stripe-webhooks',
		handlers
	}: StripeWebhooksParams): Handle =>
	async ({ event, resolve }) => {
		if (event.url.pathname === (path || '/stripe-webhooks')) {
			if (!secret || !webhookSecret) {
				DEV && console.error('[ERROR] Stripe credentials not set');
				return new Response('Webhook Error', { status: 400 });
			}

			const stripe = new Stripe(secret);
			const signature = event.request.headers.get('stripe-signature');

			if (!signature) {
				return new Response('Webhook Error', { status: 400 });
			}

			const text = await event.request.text();

			let payload: Stripe.Event;

			try {
				payload = stripe.webhooks.constructEvent(text, signature, webhookSecret);
			} catch (err) {
				return new Response('Webhook Error', { status: 400 });
			}

			const idempotencyKey = payload.request?.idempotency_key;
			let isProcessed: boolean | null | undefined = false;
			if (idempotencyKey && idempotencyStore) {
				isProcessed = await idempotencyStore.get({ event, key: idempotencyKey });
			}
			if (!isProcessed) {
				try {
					await handlers[payload.type]?.({
						event,
						// @ts-ignore
						data: payload,
						success: async () => {
							if (idempotencyKey && idempotencyStore) {
								await idempotencyStore.set({ event, key: idempotencyKey, value: true });
							}
						}
					});
				} catch (error) {
					onFailure?.(error, payload);
				}
			}

			return new Response(null, { status: 200 });
		}
		return resolve(event);
	};
