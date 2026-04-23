export async function onRequest(context) {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return context.next();
  }

  const url = new URL(context.request.url);
  const spaUrl = new URL('/', url);
  const spaRequest = new Request(spaUrl.toString(), context.request);

  return context.env.ASSETS.fetch(spaRequest);
}
