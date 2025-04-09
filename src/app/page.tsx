import { DemoGrid } from '@/components/dashboard/DemoGrid';
import { useDemoStore } from '@/store/demoStore';
import { Layout } from '@/components/common/Layout';

export default function Home() {
  const { demos } = useDemoStore();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI Demo Platform</h1>
          <p className="text-gray-600">
            Explore and interact with various AI assistants and demos.
          </p>
        </div>
        <DemoGrid demos={demos} />
      </div>
    </Layout>
  );
} 