// Datos estructurados (JSON-LD) para buscadores, sacados de studio.json: quiénes somos
// (Organization), qué vendemos (Product con una Offer por tarifa) y, si se pasan, las preguntas
// frecuentes (FAQPage). Google lee también los que se añaden con JavaScript.
const SITE = "https://www.weddingwebstudio.es";

export function addStructuredData(studio, { faq = [] } = {}) {
  const brand = studio.brand?.name || "WeddingWebs";
  const currency = studio.pricing?.currency === "€" ? "EUR" : studio.pricing?.currency || "EUR";
  const org = {
    "@type": "Organization",
    "@id": `${SITE}/#organizacion`,
    name: brand,
    url: `${SITE}/studio/`,
    logo: `${SITE}/studio/apple-touch-icon.png`,
    ...(studio.legal?.email ? { email: studio.legal.email } : {}),
  };
  const offers = (studio.pricing?.tiers || []).map((t) => {
    const [min, max] = t.price;
    return {
      "@type": "Offer",
      name: t.name,
      description: t.summary,
      price: min,
      priceCurrency: currency,
      availability: "https://schema.org/InStock",
      url: `${SITE}/studio/#tarifas`,
      // «desde 249 €»: precio mínimo, el final se cierra con la pareja.
      ...(max == null ? { priceSpecification: { "@type": "PriceSpecification", minPrice: min, priceCurrency: currency } } : {}),
    };
  });
  const graph = [org, {
    "@type": "Product",
    name: "Web de boda con confirmación de asistencia",
    description: studio.brand?.tagline,
    image: `${SITE}/studio/compartir.jpg`,
    brand: { "@id": org["@id"] },
    offers,
  }];
  if (faq.length) graph.push({
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  });
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.id = "datos-estructurados";
  s.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  document.getElementById("datos-estructurados")?.remove();
  document.head.append(s);
}
