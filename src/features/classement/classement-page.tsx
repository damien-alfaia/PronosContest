import { BarChart3 } from 'lucide-react';

import { PagePlaceholder } from '@/components/common/page-placeholder';

export const ClassementPage = () => (
  <PagePlaceholder
    titleKey="pages.classement.title"
    descriptionKey="pages.classement.placeholder"
    icon={<BarChart3 className="h-5 w-5" aria-hidden />}
  />
);
