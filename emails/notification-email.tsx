import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

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
      <Body style={{ background: "#FAF7F2", fontFamily: "Inter, Arial, sans-serif", color: "#1C1917" }}>
        <Container style={{ maxWidth: 520, margin: "24px auto", background: "#fff", borderRadius: 16, padding: 28 }}>
          <Text style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#706861", margin: 0 }}>
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
          <Text style={{ fontSize: 12, color: "#706861" }}>
            Hecho por Tana Studio · Podés desactivar estos emails desde tu perfil.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default NotificationEmail;
