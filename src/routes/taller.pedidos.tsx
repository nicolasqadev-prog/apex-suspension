import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/taller/pedidos")({
  component: TallerPedidosLayout,
});

function TallerPedidosLayout() {
  return <Outlet />;
}
