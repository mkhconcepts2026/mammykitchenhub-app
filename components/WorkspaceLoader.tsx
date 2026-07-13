"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface WorkspaceLoaderProps {
  title: string;
  subtitle: string;
  duration?: number;
}

export default function WorkspaceLoader({
  title,
  subtitle,
  duration = 1800,
}: WorkspaceLoaderProps) {
  const [progress, setProgress] = useState(0);

  const [message, setMessage] = useState(
    "Preparing secure workspace..."
  );

  useEffect(() => {
    const messages = [
      "Preparing secure workspace...",
      "Loading permissions...",
      "Connecting services...",
      "Loading workspace...",
      "Almost ready...",
    ];

    let index = 0;

    const messageTimer = setInterval(() => {
      index++;

      if (index < messages.length) {
        setMessage(messages[index]);
      }
    }, 350);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          return 100;
        }

        return prev + 4;
      });
    }, duration / 25);

    return () => {
      clearInterval(progressTimer);
      clearInterval(messageTimer);
    };
  }, [duration]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-100">

      <div className="w-full max-w-lg text-center">

        <div className="animate-pulse">

          <Image
            src="/logo.png"
            alt="MKH"
            width={120}
            height={120}
            className="mx-auto"
            priority
          />

        </div>

        <h1 className="mt-8 text-4xl font-bold text-orange-600">
          Mammy Kitchen Hub
        </h1>

        <h2 className="mt-3 text-2xl font-semibold text-gray-800">
          {title}
        </h2>

        <p className="mt-2 text-gray-500">
          {subtitle}
        </p>

        <div className="mt-12 h-3 overflow-hidden rounded-full bg-orange-100">

          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-300"
            style={{
              width: `${progress}%`,
            }}
          />

        </div>

        <p className="mt-6 font-medium text-orange-600">

          {message}

        </p>

        <p className="mt-2 text-sm text-gray-400">

          Loading {progress}%

        </p>

      </div>

    </div>
  );
}