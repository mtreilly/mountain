const CANONICAL_HOST = "mountaintoclimb.com";

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // Redirect www and *.pages.dev to the canonical domain
  if (url.hostname !== CANONICAL_HOST) {
    url.hostname = CANONICAL_HOST;
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
};
