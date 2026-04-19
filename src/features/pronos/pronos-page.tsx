import { Target } from 'lucide-react';

import { PagePlaceholder } from '@/components/common/page-placeholder';

export const PronosPage = () => (
  <PagePlaceholder
    titleKey="pages.pronos.title"
    descriptionKey="pages.pronos.placeholder"
    icon={<Target className="h-5 w-5" aria-hidden />}
  />
);
