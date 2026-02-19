const CANONICAL_HOST = "mountaintoclimb.com";

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // Redirect www and *.pages.dev to the canonical domain
  if (url.hostname !== CANONICAL_HOST) {
    url.hostname = CANONICAL_HOST;
    // Strip wildcard artefacts from the path (e.g. trailing "/*" or bare "*")
    url.pathname = url.pathname.replace(/\/?\*+$/, "") || "/";
    return Response.redirect(url.toString(), 301);
  }

  // Strip wildcard artefacts even on the canonical domain
  if (url.pathname.includes("*")) {
    url.pathname = url.pathname.replace(/\/?\*+$/, "") || "/";
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
};
