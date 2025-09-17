'use client';

import { useState } from 'react';
import {
  FolderOpen,
  Plus,
  ChevronDown,
  Calendar,
  FileText,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';
import type { Id } from '../../convex/_generated/dataModel';

interface Project {
  _id: Id<'projects'>;
  name: string;
  description?: string;
  sourceLanguage: string;
  originalData: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId: Id<'projects'> | null;
  onProjectChange: (projectId: Id<'projects'> | null) => void;
}

export function ProjectSelector({
  projects,
  currentProjectId,
  onProjectChange,
}: ProjectSelectorProps) {
  const deleteProject = useMutation(api.translations.deleteProject);

  const currentProject = projects.find((p) => p._id === currentProjectId);

  const handleDeleteProject = async (
    projectId: Id<'projects'>,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (
      confirm(
        'Are you sure you want to delete this project? This action cannot be undone.'
      )
    ) {
      try {
        await deleteProject({ projectId });

        // If we're deleting the current project, clear selection
        if (projectId === currentProjectId) {
          onProjectChange(null);
        }

        toast.success('Project deleted successfully');
      } catch (error) {
        console.error('Failed to delete project:', error);
        toast.error('Failed to delete project');
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  };

  const getKeyCount = (data: Record<string, any>): number => {
    const flattenObject = (obj: any): number => {
      let count = 0;
      for (const [key, value] of Object.entries(obj)) {
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          count += flattenObject(value);
        } else {
          count++;
        }
      }
      return count;
    };
    return flattenObject(data);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-10 px-3 justify-between min-w-[200px] font-medium bg-transparent shadow-sm hover:shadow-md transition-all duration-200"
        >
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-4 h-4" />
            <span className="truncate">
              {currentProject ? currentProject.name : 'Select Project'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-[400px] max-h-[400px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="font-semibold">Your Projects</span>
          <Badge variant="secondary" className="text-xs">
            {projects.length}
          </Badge>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Create new project option */}
        <DropdownMenuItem
          className="flex items-center space-x-3 p-3 cursor-pointer bg-gradient-to-r from-primary/5 to-secondary/5 hover:from-primary/10 hover:to-secondary/10 border border-primary/20 rounded-lg m-2"
          onClick={() => {
            onProjectChange(null);
          }}
        >
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center shadow-sm">
            <Plus className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-primary">Create New Project</div>
            <div className="text-xs text-muted-foreground">
              Upload a new JSON file to translate
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Existing projects */}
        {projects.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <p className="font-medium mb-1">No projects yet</p>
            <p className="text-xs">Create your first project to get started</p>
          </div>
        ) : (
          projects.map((project) => (
            <DropdownMenuItem
              key={project._id}
              className={`
                flex items-center space-x-3 p-3 cursor-pointer group rounded-lg m-1
                ${
                  currentProjectId === project._id
                    ? 'bg-muted border border-border'
                    : 'hover:bg-muted/50'
                }
              `}
              onClick={() => onProjectChange(project._id)}
            >
              <div className="w-8 h-8 bg-card border border-border rounded-lg flex items-center justify-center shadow-sm">
                <FileText className="w-4 h-4 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">
                  {project.name}
                </div>

                <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(project.createdAt)}</span>

                  <span>•</span>

                  <span>{getKeyCount(project.originalData)} keys</span>

                  <span>•</span>

                  <Badge variant="outline" className="text-xs">
                    {project.sourceLanguage.toUpperCase()}
                  </Badge>
                </div>

                {project.description && (
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {project.description}
                  </div>
                )}
              </div>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                onClick={(e) => handleDeleteProject(project._id, e)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
