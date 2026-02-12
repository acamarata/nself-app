import type { Metadata } from 'next';
import { ListPageContent } from './content';

export const metadata: Metadata = {
  title: 'List | nApp',
  description: 'Collaborative todo lists with real-time updates',
};

export default function ListPage({ params }: { params: { id: string } }) {
  return <ListPageContent listId={params.id} />;
}
