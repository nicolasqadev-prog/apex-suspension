import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("");
console.log("Copia estos valores (NO subas la clave privada al repo):");
console.log("");
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:tu-correo@ejemplo.com");
console.log("");
console.log("GitHub Secrets: VITE_VAPID_PUBLIC_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY");
console.log("Cloudflare Worker secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT");
console.log("");
