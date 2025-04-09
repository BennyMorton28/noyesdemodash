import Image from 'next/image';

interface DemoIconProps {
  icon: string;
  name: string;
  size?: number;
}

export default function DemoIcon({ icon, name, size = 24 }: DemoIconProps) {
  // Handle different icon path formats
  let iconPath = '';
  
  if (icon.startsWith('/')) {
    // Already has leading slash
    iconPath = icon;
  } else if (icon.includes('/')) {
    // Add leading slash to path
    iconPath = `/${icon}`;
  } else {
    // It's a simple icon name, look in /icons/ directory
    iconPath = `/icons/${icon}.svg`;
  }
  
  return (
    <div 
      className="relative inline-block mr-2 overflow-hidden"
      style={{ width: size, height: size }}
    >
      <Image
        src={iconPath}
        alt={name}
        width={size}
        height={size}
        className="object-contain"
      />
    </div>
  );
}