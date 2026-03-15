import { Settings, Database, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// We'll add a placeholder for the logo asset
// import queryCraftLogo from "@/assets/querycraft-logo.png";

interface ChatHeaderProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  onDatabaseImport: () => void;
  onSettingsClick: () => void;
  onWelcomeClick: () => void;
  sidebarTrigger?: React.ReactNode;
}

export function ChatHeader({ selectedModel, onModelChange, onDatabaseImport, onSettingsClick, onWelcomeClick, sidebarTrigger }: ChatHeaderProps) {
  return (
    <div className="sticky top-0 z-50 bg-background backdrop-blur-lg border-b border-[#1e293b] shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-3">
          {sidebarTrigger && (
            <div className="lg:hidden">
              {sidebarTrigger}
            </div>
          )}
          <div className="w-10 h-10 flex items-center justify-center bg-primary rounded-lg">
             {/* <img 
              src={queryCraftLogo.src} 
              alt="QueryCraft AI" 
              className="w-8 h-8 object-contain"
            /> */}
             <Database className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground cursor-pointer" onClick={onWelcomeClick}>
            QueryCraft
          </h1>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Bot className="w-4 h-4 text-[#94a3b8]" />
            <Select value={selectedModel} onValueChange={onModelChange}>
              <SelectTrigger className="w-32 h-9 text-sm">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <TooltipProvider>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="auto">Auto</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs text-sm">
                      <strong>Auto</strong> — automatically selects the best model based on your database and query complexity.
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="qwen:4b">Qwen AI</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs text-sm">
                      <strong>Qwen (4B)</strong> — faster, smaller model with a lower context window; great for quick, low-latency replies.
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="gemini-2.5-flash">Gemini</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs text-sm">
                      <strong>Gemini</strong> — great general-purpose model with balanced speed and reasoning.
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="phi3-mini">Phi-3 Mini</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs text-sm">
                      <strong>Phi-3 Mini (4K instruct)</strong> — very efficient small model with good quality and low latency.
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="llama3.2:1b">Llama 1B</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs text-sm">
                      <strong>Llama (1B)</strong> — very efficient small model with good quality and low latency.
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="mistral:7b-instruct">Mistral AI</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs text-sm">
                      <strong>Mistral (7B)</strong> — larger and more capable with a bigger context window; slightly slower but better for complex prompts.
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="or-deepseek-r1">DeepSeek R1</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs text-sm">
                      <strong>DeepSeek R1</strong> — larger and more capable with a bigger context window.
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="or-grok-code-fast">Grok Code Fast</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs text-sm">
                      <strong>Grok Code Fast</strong> — optimized for code understanding and generation; ideal for database query tasks.
                    </TooltipContent> 
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="or-qwen3-235b-a22b">Qwen3 235B A22B</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs text-sm">
                      <strong>Qwen3 235B A22B</strong> — state-of-the-art model with extensive knowledge and advanced reasoning.
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SelectItem value="or-qwen3-coder">Qwen3 Coder</SelectItem>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" className="max-w-xs text-sm">
                      <strong>Qwen3 Coder</strong> — specialized for coding tasks, excellent for generating and understanding database queries.
                    </TooltipContent>
                  </Tooltip>
                
                </TooltipProvider>
              </SelectContent>
            </Select>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-[#94a3b8]"
                  onClick={onDatabaseImport}
                >
                  <Database className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Import Database</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-[#94a3b8]"
                  onClick={onSettingsClick}
                >
                  <Settings className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
