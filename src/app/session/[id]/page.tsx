'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Session, CaptionOptions, ImageData } from '@/lib/types';

interface DashboardState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  selectedImages: string[];
  customText: {
    opener: string;
    body: string;
    closer: string;
  };
  selectedOpener: string | null;
  selectedBody: string | null;
  selectedCloser: string | null;
  useCustomOpener: boolean;
  useCustomBody: boolean;
  useCustomCloser: boolean;
  selectedHashtags: Set<string>;
  selectedPlatforms: Set<string>;
  scheduleType: 'now' | 'nextStandard' | 'todayStandard' | 'tomorrowStandard' | 'custom';
  customDate: string;
  customTime: string;
  submitting: boolean;
  submitError: string | null;
  submitted: boolean;
  submitMessage: string | null;
}

const TIMEZONE = 'Europe/Amsterdam';

function getStandardTime(date: Date): string {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return '13:00';
  }
  return '19:00';
}

function getNextStandardTime(): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);
  return tomorrow.toISOString();
}

function formatCaption(
  opener: string,
  body: string,
  closer: string,
  hashtags: string[]
): string {
  const parts = [opener, body, closer].filter((p) => p.trim());
  const caption = parts.join('\n\n');
  const hashtagString = hashtags.length > 0 ? '\n\n' + hashtags.join(' ') : '';
  return caption + hashtagString;
}

export default function SessionDashboard() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [state, setState] = useState<DashboardState>({
    session: null,
    loading: true,
    error: null,
    selectedImages: [],
    customText: { opener: '', body: '', closer: '' },
    selectedOpener: null,
    selectedBody: null,
    selectedCloser: null,
    useCustomOpener: false,
    useCustomBody: false,
    useCustomCloser: false,
    selectedHashtags: new Set(),
    selectedPlatforms: new Set(['instagram', 'facebook']),
    scheduleType: 'nextStandard',
    customDate: new Date().toISOString().split('T')[0],
    customTime: '19:00',
    submitting: false,
    submitError: null,
    submitted: false,
    submitMessage: null,
  });

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        const result = await response.json();

        if (!result.success) throw new Error(result.error);

        const data = result.session;
        setState((prev) => ({
          ...prev,
          session: data,
          selectedOpener: data.caption_options?.openers?.[0] || null,
          selectedBody: data.caption_options?.bodies?.[0] || null,
          selectedCloser: data.caption_options?.closers?.[0] || null,
          loading: false,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: 'Sessie kon niet worden geladen',
          loading: false,
        }));
      }
    };

    fetchSession();
  }, [sessionId]);

  const toggleImageSelection = (imageUrl: string) => {
    setState((prev) => ({
      ...prev,
      selectedImages: prev.selectedImages.includes(imageUrl)
        ? prev.selectedImages.filter((u) => u !== imageUrl)
        : [...prev.selectedImages, imageUrl],
    }));
  };

  const moveImageInSelection = (fromIndex: number, toIndex: number) => {
    const newSelection = [...state.selectedImages];
    const [removed] = newSelection.splice(fromIndex, 1);
    newSelection.splice(toIndex, 0, removed);
    setState((prev) => ({ ...prev, selectedImages: newSelection }));
  };

  const toggleHashtag = (hashtag: string) => {
    setState((prev) => {
      const newSet = new Set(prev.selectedHashtags);
      if (newSet.has(hashtag)) {
        newSet.delete(hashtag);
      } else {
        newSet.add(hashtag);
      }
      return { ...prev, selectedHashtags: newSet };
    });
  };

  const togglePlatform = (platform: string) => {
    setState((prev) => {
      const newSet = new Set(prev.selectedPlatforms);
      if (newSet.has(platform)) {
        newSet.delete(platform);
      } else {
        newSet.add(platform);
      }
      return { ...prev, selectedPlatforms: newSet };
    });
  };

  const getScheduledTime = (): string => {
    const now = new Date();

    switch (state.scheduleType) {
      case 'now':
        return now.toISOString();
      case 'nextStandard':
        return getNextStandardTime();
      case 'todayStandard': {
        const today = new Date();
        const time = getStandardTime(today);
        today.setHours(parseInt(time.split(':')[0]), parseInt(time.split(':')[1]), 0, 0);
        return today.toISOString();
      }
      case 'tomorrowStandard': {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const time = getStandardTime(tomorrow);
        tomorrow.setHours(parseInt(time.split(':')[0]), parseInt(time.split(':')[1]), 0, 0);
        return tomorrow.toISOString();
      }
      case 'custom': {
        const customDateTime = new Date(`${state.customDate}T${state.customTime}`);
        return customDateTime.toISOString();
      }
      default:
        return now.toISOString();
    }
  };

  const handleSubmit = async () => {
    if (state.selectedImages.length === 0) {
      setState((prev) => ({ ...prev, submitError: 'Selecteer minstens één afbeelding' }));
      return;
    }

    if (!state.selectedOpener && !state.useCustomOpener) {
      setState((prev) => ({ ...prev, submitError: 'Selecteer een opening of schrijf je eigen tekst' }));
      return;
    }

    setState((prev) => ({ ...prev, submitting: true, submitError: null }));

    try {
      const opener = state.useCustomOpener ? state.customText.opener : state.selectedOpener || '';
      const body = state.useCustomBody ? state.customText.body : state.selectedBody || '';
      const closer = state.useCustomCloser ? state.customText.closer : state.selectedCloser || '';

      const caption = formatCaption(opener, body, closer, Array.from(state.selectedHashtags));

      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          caption,
          image_urls: state.selectedImages,
          platforms: Array.from(state.selectedPlatforms),
          scheduled_for: getScheduledTime(),
          timezone: TIMEZONE,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Scheduling failed');
      }

      setState((prev) => ({
        ...prev,
        submitting: false,
        submitted: true,
        submitMessage: result.message || 'Post is succesvol ingepland!',
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        submitError: err instanceof Error ? err.message : 'Post kon niet worden ingepland',
        submitting: false,
      }));
    }
  };

  if (state.loading) {
    return (
      <div className="min-h-screen bg-woody-bg flex items-center justify-center">
        <div className="text-woody-primary">Sessie wordt geladen...</div>
      </div>
    );
  }

  if (state.error || !state.session) {
    return (
      <div className="min-h-screen bg-woody-bg flex items-center justify-center">
        <div className="text-red-600">{state.error || 'Sessie niet gevonden'}</div>
      </div>
    );
  }

  if (state.submitted) {
    return (
      <div className="min-h-screen bg-woody-bg flex items-center justify-center">
        <div className="card text-center max-w-md mx-auto">
          <div className="text-4xl mb-4">&#10003;</div>
          <h2 className="text-2xl font-bold text-woody-primary mb-2">Post ingepland!</h2>
          <p className="text-gray-600 mb-6">{state.submitMessage}</p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Terug naar overzicht
          </button>
        </div>
      </div>
    );
  }

  const caption = formatCaption(
    state.useCustomOpener ? state.customText.opener : state.selectedOpener || '',
    state.useCustomBody ? state.customText.body : state.selectedBody || '',
    state.useCustomCloser ? state.customText.closer : state.selectedCloser || '',
    Array.from(state.selectedHashtags)
  );

  const wordCount = caption.split(/\s+/).filter((w) => w.length > 0).length;

  return (
    <div className="min-h-screen bg-woody-bg">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-woody-primary mb-2">Post Builder</h1>
          <p className="text-gray-600">Maak je post en plan deze in</p>
        </header>

        {state.submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {state.submitError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Panel - Builder */}
          <div className="lg:col-span-2 space-y-8">
            {/* Photo Grid */}
            <section className="card">
              <h2 className="text-xl font-bold text-woody-primary mb-4">Foto's selecteren</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                {(state.session.images || []).map((image) => (
                  <div
                    key={image.id}
                    onClick={() => toggleImageSelection(image.url)}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                      state.selectedImages.includes(image.url)
                        ? 'border-woody-primary ring-2 ring-woody-accent'
                        : 'border-gray-200'
                    }`}
                  >
                    <Image
                      src={image.url}
                      alt={image.alt_text || 'Product'}
                      width={150}
                      height={150}
                      className="w-full h-32 object-cover"
                    />
                    {state.selectedImages.includes(image.url) && (
                      <div className="absolute top-1 right-1 bg-woody-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                        {state.selectedImages.indexOf(image.url) + 1}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {state.selectedImages.length > 0 && (
                <div>
                  <h3 className="font-semibold text-woody-primary mb-3">
                    Volgorde aanpassen
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {state.selectedImages.map((imageUrl, idx) => {
                      const image = state.session?.images.find((i) => i.url === imageUrl);
                      return (
                        <div
                          key={imageUrl}
                          className="flex items-center gap-1 bg-white border-2 border-woody-primary rounded-lg p-2"
                        >
                          <button
                            onClick={() => moveImageInSelection(idx, Math.max(0, idx - 1))}
                            disabled={idx === 0}
                            className="px-2 py-1 text-woody-primary disabled:opacity-50"
                          >
                            ←
                          </button>
                          <span className="font-semibold text-woody-primary">{idx + 1}</span>
                          <button
                            onClick={() =>
                              moveImageInSelection(
                                idx,
                                Math.min(state.selectedImages.length - 1, idx + 1)
                              )
                            }
                            disabled={idx === state.selectedImages.length - 1}
                            className="px-2 py-1 text-woody-primary disabled:opacity-50"
                          >
                            →
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Caption Builder */}
            <section className="card">
              <h2 className="text-xl font-bold text-woody-primary mb-4">Tekst opstellen</h2>

              {/* Openers */}
              <div className="mb-6">
                <h3 className="font-semibold text-woody-primary mb-3">Opening</h3>
                {!state.useCustomOpener ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    {(state.session.caption_options?.openers || []).map((opener) => (
                      <div
                        key={opener}
                        onClick={() => setState((prev) => ({ ...prev, selectedOpener: opener }))}
                        className={`option-card ${
                          state.selectedOpener === opener ? 'selected' : ''
                        }`}
                      >
                        {opener}
                      </div>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={state.customText.opener}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        customText: { ...prev.customText, opener: e.target.value },
                      }))
                    }
                    className="input-field mb-3"
                    rows={2}
                  />
                )}
                <button
                  onClick={() =>
                    setState((prev) => ({ ...prev, useCustomOpener: !prev.useCustomOpener }))
                  }
                  className="text-sm text-woody-secondary hover:text-woody-primary underline"
                >
                  {state.useCustomOpener ? 'Kies uit opties' : 'Eigen tekst schrijven'}
                </button>
              </div>

              {/* Bodies */}
              <div className="mb-6">
                <h3 className="font-semibold text-woody-primary mb-3">Inhoud</h3>
                {!state.useCustomBody ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    {(state.session.caption_options?.bodies || []).map((body) => (
                      <div
                        key={body}
                        onClick={() => setState((prev) => ({ ...prev, selectedBody: body }))}
                        className={`option-card ${state.selectedBody === body ? 'selected' : ''}`}
                      >
                        {body}
                      </div>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={state.customText.body}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        customText: { ...prev.customText, body: e.target.value },
                      }))
                    }
                    className="input-field mb-3"
                    rows={3}
                  />
                )}
                <button
                  onClick={() => setState((prev) => ({ ...prev, useCustomBody: !prev.useCustomBody }))}
                  className="text-sm text-woody-secondary hover:text-woody-primary underline"
                >
                  {state.useCustomBody ? 'Kies uit opties' : 'Eigen tekst schrijven'}
                </button>
              </div>

              {/* Closers */}
              <div className="mb-6">
                <h3 className="font-semibold text-woody-primary mb-3">Afsluiting</h3>
                {!state.useCustomCloser ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    {(state.session.caption_options?.closers || []).map((closer) => (
                      <div
                        key={closer}
                        onClick={() => setState((prev) => ({ ...prev, selectedCloser: closer }))}
                        className={`option-card ${
                          state.selectedCloser === closer ? 'selected' : ''
                        }`}
                      >
                        {closer}
                      </div>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={state.customText.closer}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        customText: { ...prev.customText, closer: e.target.value },
                      }))
                    }
                    className="input-field mb-3"
                    rows={2}
                  />
                )}
                <button
                  onClick={() =>
                    setState((prev) => ({ ...prev, useCustomCloser: !prev.useCustomCloser }))
                  }
                  className="text-sm text-woody-secondary hover:text-woody-primary underline"
                >
                  {state.useCustomCloser ? 'Kies uit opties' : 'Eigen tekst schrijven'}
                </button>
              </div>

              {/* Hashtags */}
              <div className="mb-6">
                <h3 className="font-semibold text-woody-primary mb-3">Hashtags</h3>
                <div className="flex flex-wrap gap-2">
                  {(state.session.caption_options?.hashtags || []).map((hashtag) => (
                    <button
                      key={hashtag}
                      onClick={() => toggleHashtag(hashtag)}
                      className={`chip ${state.selectedHashtags.has(hashtag) ? 'active' : ''}`}
                    >
                      {hashtag}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Scheduling */}
            <section className="card">
              <h2 className="text-xl font-bold text-woody-primary mb-4">Inplannen</h2>

              {/* Platforms */}
              <div className="mb-6">
                <h3 className="font-semibold text-woody-primary mb-3">Platforms</h3>
                <div className="flex gap-4">
                  {['instagram', 'facebook'].map((platform) => (
                    <label key={platform} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.selectedPlatforms.has(platform)}
                        onChange={() => togglePlatform(platform)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="capitalize text-woody-primary font-medium">
                        {platform === 'instagram' ? 'Instagram' : 'Facebook'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Schedule Types */}
              <div className="mb-6">
                <h3 className="font-semibold text-woody-primary mb-3">Timing</h3>
                <div className="space-y-3">
                  {[
                    { id: 'now', label: 'Nu direct' },
                    { id: 'nextStandard', label: 'Eerstvolgende standaardtijd' },
                    { id: 'todayStandard', label: 'Vandaag standaardtijd' },
                    { id: 'tomorrowStandard', label: 'Morgen standaardtijd' },
                    { id: 'custom', label: 'Kies datum en tijd' },
                  ].map((option) => (
                    <label key={option.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="schedule"
                        value={option.id}
                        checked={state.scheduleType === option.id}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            scheduleType: e.target.value as any,
                          }))
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-woody-primary">{option.label}</span>
                    </label>
                  ))}
                </div>

                {state.scheduleType === 'custom' && (
                  <div className="mt-4 flex gap-3">
                    <input
                      type="date"
                      value={state.customDate}
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, customDate: e.target.value }))
                      }
                      className="input-field"
                    />
                    <input
                      type="time"
                      value={state.customTime}
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, customTime: e.target.value }))
                      }
                      className="input-field"
                    />
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Instagram Preview */}
              <div className="card p-0 overflow-hidden">
                <h3 className="font-semibold text-woody-primary p-4 pb-0">Instagram Voorbeeld</h3>
                <div className="bg-white mx-auto max-w-[360px]">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                        <span className="text-[10px] font-bold text-gray-800">WK</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">woodykids_shop</span>
                  </div>
                  {/* Image - 4:5 portrait ratio */}
                  <div className="bg-gray-100 relative" style={{ aspectRatio: '4/5' }}>
                    {state.selectedImages.length > 0 ? (
                      <Image
                        src={state.selectedImages[0]}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        Selecteer een foto
                      </div>
                    )}
                    {state.selectedImages.length > 1 && (
                      <div className="absolute top-3 right-3 bg-gray-900/70 text-white text-xs px-2 py-1 rounded-full">
                        1/{state.selectedImages.length}
                      </div>
                    )}
                  </div>
                  {/* Action icons */}
                  <div className="flex items-center px-3 py-2 gap-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  </div>
                  {/* Caption */}
                  <div className="px-3 pb-3">
                    <div className="text-sm">
                      <span className="font-semibold text-gray-900">woodykids_shop </span>
                      <span className="text-gray-800 whitespace-pre-wrap">{caption}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Word Count */}
              <div className="card">
                <div className="flex justify-between items-center">
                  <span className="text-woody-primary font-semibold">Woorden:</span>
                  <span className="text-2xl font-bold text-woody-secondary">{wordCount}</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={state.submitting}
                className="w-full btn-primary disabled:opacity-50"
              >
                {state.submitting ? 'Inplannen...' : 'Post inplannen'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
