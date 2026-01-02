"use client";

import { useState } from "react";
import { Bot, X, Sparkles, MessageSquare, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AIAssistantProps {
  /**
   * Zapier Chatbot embed URL or script
   * Leave empty to show placeholder
   */
  embedUrl?: string;
  /**
   * Whether to use iframe or script embed
   */
  embedType?: "iframe" | "script" | "placeholder";
}

export function AIAssistant({ 
  embedUrl, 
  embedType = "placeholder" 
}: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(true);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            className={cn(
              "h-14 w-14 rounded-full shadow-lg transition-all duration-300",
              "bg-[#AC0F16] hover:bg-[#AC0F16]/90 hover:scale-105",
              "focus-visible:ring-2 focus-visible:ring-[#AC0F16]/50 focus-visible:ring-offset-2",
              isOpen && "scale-95"
            )}
          >
            {isOpen ? (
              <X className="h-6 w-6 text-white" />
            ) : (
              <div className="relative">
                <Bot className="h-6 w-6 text-white" />
                {hasNewMessage && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#2EAFC5] animate-pulse" />
                )}
              </div>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="end"
          sideOffset={16}
          className={cn(
            "w-[380px] h-[500px] p-0 rounded-2xl overflow-hidden",
            "bg-[#F9F6F0] border-none shadow-2xl"
          )}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#AC0F16] to-[#AC0F16]/80 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">AI Assistant</h3>
                <p className="text-xs text-white/80">
                  Powered by Christian Minimart Intelligence
                </p>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="h-[calc(100%-60px)] flex flex-col">
            {embedType === "iframe" && embedUrl ? (
              <iframe
                src={embedUrl}
                className="w-full h-full border-none"
                title="AI Assistant"
                allow="microphone"
              />
            ) : embedType === "script" && embedUrl ? (
              <div 
                className="w-full h-full"
                dangerouslySetInnerHTML={{ __html: embedUrl }}
              />
            ) : (
              <PlaceholderContent onDismiss={() => setHasNewMessage(false)} />
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Tooltip hint when closed */}
      {!isOpen && (
        <div className="absolute bottom-full right-0 mb-2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-[#2d1b1a] text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap">
            Ask me anything!
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Placeholder Content (Before Zapier Integration)
// =============================================================================

function PlaceholderContent({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex-1 flex flex-col p-4">
      {/* Welcome Message */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        <div className="h-16 w-16 rounded-full bg-[#AC0F16]/10 flex items-center justify-center mb-4">
          <MessageSquare className="h-8 w-8 text-[#AC0F16]" />
        </div>
        <h4 className="font-semibold text-[#2d1b1a] mb-2">
          Welcome to Christian Minimart AI
        </h4>
        <p className="text-sm text-[#6c5e5d] mb-6">
          Ask about inventory, sales trends, or get smart restocking recommendations.
        </p>

        {/* Sample Questions */}
        <div className="w-full space-y-2">
          <p className="text-xs text-[#6c5e5d] uppercase tracking-wider mb-2">
            Try asking:
          </p>
          {[
            "How is Coca-Cola doing?",
            "What products need restocking?",
            "Show me sales trends",
            "Log a new brand promotion",
          ].map((question, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2 rounded-lg bg-[#EDE5D8] hover:bg-[#EDE5D8]/70 text-sm text-[#2d1b1a] transition-colors"
              onClick={onDismiss}
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      {/* Integration Instructions */}
      <div className="border-t border-[#EDE5D8] pt-4 mt-4">
        <div className="bg-[#EDE5D8]/50 rounded-lg p-3">
          <p className="text-xs text-[#6c5e5d] mb-2">
            <strong>Developer Note:</strong> Paste your Zapier Chatbot embed code below:
          </p>
          <code className="block text-xs bg-[#2d1b1a] text-[#F9F6F0] p-2 rounded font-mono overflow-x-auto">
            {`<AIAssistant embedUrl="YOUR_ZAPIER_URL" embedType="iframe" />`}
          </code>
          <a
            href="https://zapier.com/app/chatbots"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[#AC0F16] hover:underline mt-2"
          >
            Create Zapier Chatbot
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Export for Easy Integration
// =============================================================================

export default AIAssistant;
