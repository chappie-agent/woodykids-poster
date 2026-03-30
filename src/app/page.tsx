import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase';

interface SessionCard {
  id: string;
  created_at: string;
  product_count: number;
  image_count: number;
}

export default async function HomePage() {
  let sessions: SessionCard[] = [];
  let error: string | null = null;

  try {
    const { data, error: fetchError } = await supabaseServer
      .from('sessions')
      .select('id, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (fetchError) {
      error = fetchError.message;
    } else if (data) {
      sessions = data.map((session: any) => ({
        id: session.id,
        created_at: session.created_at,
        product_count: 0,
        image_count: 0,
      }));
    }
  } catch (err) {
    error = 'Failed to load sessions';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-woody-bg to-white">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-woody-primary mb-2">
            WoodyKids Post Builder
          </h1>
          <p className="text-gray-600">
            Maak en plan moeiteloos posts in op Instagram en Facebook
          </p>
        </header>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="card max-w-md mx-auto">
              <p className="text-gray-600 mb-6">
                Geen sessies beschikbaar. Start een nieuwe post via{' '}
                <code className="bg-gray-100 px-2 py-1 rounded">/post</code> in Claude.
              </p>
              <p className="text-sm text-gray-500">
                Eenmaal je een sessie hebt gestart, verschijnt deze hier en kun je
                aan de slag met het maken van je post.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => {
              const createdDate = new Date(session.created_at);
              const formattedDate = createdDate.toLocaleDateString('nl-NL', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <Link
                  key={session.id}
                  href={`/session/${session.id}`}
                  className="card hover:shadow-lg hover:border-woody-primary transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg text-woody-primary">
                        Sessie
                      </h3>
                      <p className="text-sm text-gray-500">{formattedDate}</p>
                    </div>
                    <div className="bg-woody-accent text-woody-primary px-3 py-1 rounded-full text-sm font-medium">
                      Wachtend
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4">
                    Klaar om je post op te stellen
                  </p>
                  <button className="w-full btn-primary text-sm">
                    Sessie openen →
                  </button>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
