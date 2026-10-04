'use client';

import { useEffect, useRef, useState } from 'react';
import { commands } from '@/lib/net';
import { useGameStore } from '@/stores/gameStore';

export function ChatBox() {
  const chat = useGameStore((s) => s.chat);
  const [text, setText] = useState('');
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [chat]);

  return (
    <section className="panel flex min-h-40 flex-1 flex-col p-3">
      <h3 className="font-display mb-2 text-sm font-bold tracking-wide text-slate-300">CHAT</h3>
      <div ref={list} className="min-h-0 flex-1 space-y-1 overflow-y-auto text-sm">
        {chat.length === 0 && <p className="text-xs text-slate-500">Say hi (or talk some trash).</p>}
        {chat.map((m, i) => (
          <p key={i}>
            <span className="font-semibold text-amber-200">{m.name}:</span>{' '}
            <span className="text-slate-200">{m.text}</span>
          </p>
        ))}
      </div>
      <form
        className="mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          void commands.chat(text.trim());
          setText('');
        }}
      >
        <input
          className="input py-1.5 text-sm"
          placeholder="Say something…"
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
        />
      </form>
    </section>
  );
}
