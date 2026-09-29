import React from 'react';
import { openStorageFile, PrivateBucket } from '../../lib/storageFiles';

interface StorageFileLinkProps {
  bucket: PrivateBucket;
  value: string;
  children: React.ReactNode;
  download?: boolean;
  className?: string;
  title?: string;
}

// Link para arquivo de bucket privado: gera um link assinado só no clique.
export const StorageFileLink = ({
  bucket,
  value,
  children,
  download,
  className,
  title,
}: StorageFileLinkProps) => (
  <a
    href="#"
    role="button"
    title={title}
    className={className}
    onClick={(event) => {
      event.preventDefault();
      void openStorageFile(bucket, value, { download });
    }}
  >
    {children}
  </a>
);
