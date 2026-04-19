import { Trophy } from 'lucide-react';

import { PagePlaceholder } from '@/components/common/page-placeholder';

export const ConcoursPage = () => (
  <PagePlaceholder
    titleKey="pages.concours.title"
    descriptionKey="pages.concours.placeholder"
    icon={<Trophy className="h-5 w-5" aria-hidden />}
  />
);
