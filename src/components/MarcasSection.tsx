import { MARCAS } from "@/lib/marcas";

export default function MarcasSection() {
  const marcas = Object.values(MARCAS);

  return (
    <section className="px-4 py-16 md:py-24 bg-[oklch(0.14_0.04_250)] border-y border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-[oklch(0.7_0.2_40)] font-bold">
            Marcas principales
          </p>
          <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold uppercase text-white tracking-wide">
            Referencias confiables para el taller
          </h2>
          <p className="mt-4 text-sm sm:text-base text-gray-400 leading-relaxed">
            Trabajamos con marcas reconocidas en suspensión, dirección y sellos. Si no ves una
            referencia, la buscamos por ti.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {marcas.map((m) => (
            <div
              key={m.nombre}
              className="rounded-xl border border-gray-800 bg-[oklch(0.18_0.04_250)] p-5 hover:border-[oklch(0.7_0.2_40)]/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-extrabold tracking-tight text-white">{m.nombre}</p>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {m.foco.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-400 leading-relaxed">{m.descripcionCorta}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
