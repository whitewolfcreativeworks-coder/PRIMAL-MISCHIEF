import { CIVS, type CivId } from '@pm/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { galleryScenes } from '../holo/gallery';
import { Theater, type Vignette } from '../holo/theater';
import { CivEmblem } from '../art/motifs';

/** Hologram Theater: watch any scene the game can project, for any civilization. */
export function Gallery({ onBack, initialCiv }: { onBack: () => void; initialCiv?: CivId }) {
  const [civ, setCiv] = useState<CivId>(initialCiv ?? 'kush');
  const [rival, setRival] = useState<CivId>(civ === 'sumer' ? 'kush' : 'sumer');
  const items = useMemo(() => galleryScenes(civ, rival), [civ, rival]);
  const groups = useMemo(() => [...new Set(items.map((i) => i.group))], [items]);
  const [group, setGroup] = useState('Battles');
  const [playing, setPlaying] = useState<Vignette | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const theater = useRef<Theater | null>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const t = new Theater(canvas.current);
    t.onChange = setPlaying;
    theater.current = t;
    (window as unknown as { __holo?: unknown }).__holo = { still: (i: number, at: number) => t.still(itemsRef.current[i].make(), at), bloom: (x: number) => t.setBloom(x), list: () => itemsRef.current.map((x) => `${x.group} / ${x.label}`) };
    return () => { t.dispose(); theater.current = null; };
  }, []);

  const play = (i: number) => { const t = theater.current; if (!t) return; t.skipAll(); t.enqueue(items[i].make()); };
  const playGroup = () => { const t = theater.current; if (!t) return; t.skipAll(); items.forEach((it) => { if (it.group === group) t.enqueue(it.make()); }); };

  return (
    <div className="screen gallery">
      <header className="gallery-head">
        <button className="btn ghost" onClick={onBack}>Back</button>
        <h2>Hologram Theater</h2>
      </header>
      <div className="gallery-civs">
        <span>Civilization</span>
        {CIVS.map((c) => <button key={c.id} className={`civ-chip ${civ === c.id ? 'on' : ''}`} aria-label={c.name} onClick={() => { setCiv(c.id); if (rival === c.id) setRival(c.id === 'sumer' ? 'kush' : 'sumer'); }}><CivEmblem civ={c.id} palette={c.palette} size={30} /><b>{c.name}</b></button>)}
      </div>
      <div className="gallery-civs">
        <span>Rival</span>
        {CIVS.filter((c) => c.id !== civ).map((c) => <button key={c.id} className={`civ-chip ${rival === c.id ? 'on' : ''}`} aria-label={`Rival ${c.name}`} onClick={() => setRival(c.id)}><CivEmblem civ={c.id} palette={c.palette} size={30} /><b>{c.name}</b></button>)}
      </div>
      <div className={`gallery-stage holo-preview ${playing ? 'on' : ''}`} onClick={() => theater.current?.skip()}>
        <canvas ref={canvas} />
        <span>{playing ? playing.caption : 'Choose a scene'}</span>
      </div>
      <div className="seg gallery-groups">
        {groups.map((g) => <button key={g} className={group === g ? 'on' : ''} onClick={() => setGroup(g)}>{g}</button>)}
      </div>
      <div className="gallery-list">
        <button className="btn primary small" onClick={playGroup}>Play all {group.toLowerCase()}</button>
        {items.map((it, i) => it.group === group && <button key={`${it.group}-${it.label}-${i}`} className="btn small" onClick={() => play(i)}>{it.label}</button>)}
      </div>
    </div>
  );
}
