import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from "@react-email/components";

const logoBase = process.env.APP_URL ?? "";

export function NotificationEmail({
  title,
  body,
  ctaUrl,
  brandName,
  color,
  name,
}: {
  title: string;
  body: string;
  ctaUrl: string;
  brandName: string;
  color: string;
  name: string;
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{title}</Preview>
      <Body style={{ background: "#F6F3EF", fontFamily: "Inter, Arial, sans-serif", color: "#2B1D1F" }}>
        <Container style={{ maxWidth: 520, margin: "24px auto", background: "#fff", borderRadius: 16, padding: 28 }}>
          <Img src={`${logoBase}/brand/tana-logo.png`} alt="Tana Studio" height="44" style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#746567", margin: 0 }}>
            {brandName}
          </Text>
          <Heading style={{ fontSize: 22, margin: "8px 0 12px" }}>{title}</Heading>
          {name && <Text style={{ margin: "0 0 8px" }}>Hola {name.split(" ")[0]}:</Text>}
          <Text style={{ whiteSpace: "pre-line", lineHeight: 1.5 }}>{body}</Text>
          <Section style={{ margin: "20px 0" }}>
            <Button
              href={ctaUrl}
              style={{ background: color, color: "#fff", padding: "12px 20px", borderRadius: 12, fontWeight: 600 }}
            >
              Abrir en el calendario
            </Button>
          </Section>
          <Text style={{ fontSize: 12, color: "#746567" }}>
            Hecho por Tana Studio · Podés desactivar estos emails desde tu perfil.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default NotificationEmail;
