import { etiquetaMarcaProveedor, metaMarcaProveedor } from "@/lib/marcas-proveedor";

type Props = {
  marcaProducto: string | undefined | null;
  /** compact = solo pill; default = logo + texto */
  variant?: "default" | "compact";
  className?: string;
};

export function MarcaProveedorBadge({
  marcaProducto,
  variant = "default",
  className = "",
}: Props) {
  const etiqueta = etiquetaMarcaProveedor(marcaProducto);
  const meta = metaMarcaProveedor(marcaProducto);

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-300 ${className}`}
        title={`Marca del producto: ${etiqueta}`}
      >
        {etiqueta}
      </span>
    );
  }

  return (
    <div
      className={`flex items-center gap-2.5 ${className}`}
      title={`Marca del producto: ${etiqueta}`}
    >
      {meta?.logoSrc ? (
        <img
          src={meta.logoSrc}
          alt=""
          aria-hidden
          className="h-6 w-auto max-w-[72px] object-contain object-left opacity-90"
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500 leading-tight">
        Marca
        <span className="block text-xs font-bold tracking-normal text-white normal-case">
          {etiqueta}
        </span>
      </p>
    </div>
  );
}
