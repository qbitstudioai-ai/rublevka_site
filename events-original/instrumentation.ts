/**
 * Выполняется один раз при запуске сервера Next.js.
 * В production неверная конфигурация останавливает запуск с понятной ошибкой.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { onServerStart } = await import("./instrumentation-node");
  await onServerStart();
}
