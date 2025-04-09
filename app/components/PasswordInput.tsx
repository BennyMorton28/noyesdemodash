import React, { useState } from 'react';

interface PasswordInputProps {
  assistantId: string;
  onUnlock: (assistantId: string) => void;
  checkPassword: (assistantId: string, password: string) => boolean;
  onError?: (error: string) => void;
}

const PasswordInput: React.FC<PasswordInputProps> = ({ 
  assistantId,
  onUnlock,
  checkPassword,
  onError
}) => {
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (checkPassword(assistantId, password)) {
      onUnlock(assistantId);
      setPassword('');
      setError(null);
    } else {
      const errorMsg = 'Incorrect password';
      setError(errorMsg);
      if (onError) onError(errorMsg);
    }
  };

  return (
    <div className="mt-2" onClick={e => e.stopPropagation()}>
      <input
        type="password"
        placeholder="Enter password"
        className="w-full text-xs p-1 border rounded"
        value={password}
        onChange={(e) => {
          e.stopPropagation();
          setPassword(e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        autoComplete="off"
      />
      <button
        className="mt-1 w-full text-xs bg-blue-500 text-white rounded p-1"
        onClick={handlePasswordSubmit}
      >
        Unlock
      </button>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
};

export default PasswordInput; 