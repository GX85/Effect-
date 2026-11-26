'use client';
import { lazy, Suspense, useRef, type RefObject } from 'react';
import { ArrowLeft, X, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { rapidTiers, type RapidTier } from '@/lib/rapid';
const Rapid = lazy(() => import('./Rapid'));
export default function RapidPreview({
  tier,
  open,
  onChange,
  onClose,
  returnFocus,
}: {
  tier: RapidTier;
  open: boolean;
  onChange: (tier: RapidTier) => void;
  onClose: () => void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="focus-rapid-preview"
        showCloseButton={false}
        finalFocus={returnFocus}
      >
        <DialogTitle className="sr-only">
          Rapid — примеры сайтов Focus
        </DialogTitle>
        <DialogDescription className="sr-only">
          Сравните три версии одного бренда. Переключайте тарифы сверху.
          Закройте просмотр, чтобы вернуться в Focus на прежнее место.
        </DialogDescription>
        <Tabs
          value={tier}
          onValueChange={(value) => {
            onChange(value as RapidTier);
            scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
          }}
          className="focus-preview-tabs"
        >
          <header className="focus-preview-toolbar" lang="ru">
            <DialogClose className="focus-preview-back">
              <ArrowLeft size={17} />
              <span>В Focus</span>
            </DialogClose>
            <TabsList
              className="focus-preview-tier-list"
              aria-label="Тариф демонстрации"
            >
              {rapidTiers.map((t) => (
                <TabsTrigger value={t.id} key={t.id}>
                  <span>{t.name}</span>
                  {t.id === 'imapro' ? (
                    <small>
                      <Sparkles size={12} /> Premium
                    </small>
                  ) : (
                    <small>${t.price}</small>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <DialogClose
              className="focus-preview-close"
              aria-label="Закрыть пример Rapid"
            >
              <X size={21} />
            </DialogClose>
          </header>
          <div className="focus-preview-scroll" ref={scrollRef}>
            {rapidTiers.map((t) => (
              <TabsContent value={t.id} key={t.id}>
                <Suspense
                  fallback={
                    <div className="focus-preview-loading">
                      RAPID<span>Открываем пример…</span>
                    </div>
                  }
                >
                  <Rapid tier={t.id} embedded onClose={onClose} />
                </Suspense>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
