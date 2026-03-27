
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  
  // Debounce search to avoid excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <div className="relative w-full md:max-w-md mx-auto mb-4 sm:mb-6 px-3 md:px-0">
      <Search className="absolute left-5 md:left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
      <Input
        type="text"
        placeholder="Search by name, brand, or model..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pl-10 pr-4 py-2 w-full border-gray-300 focus:border-royal focus:ring focus:ring-royal-light focus:ring-opacity-50 rounded-md shadow-sm"
      />
    </div>
  );
};

export default SearchBar;
