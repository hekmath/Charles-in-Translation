'use client';
import {
  FolderOpen,
  Plus,
  ChevronDown,
  Calendar,
  FileText,
  Trash2,
  Loader2,
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
import { useDeleteProject } from '@/lib/hooks/use-api';
import { useProject } from '@/context/project-context';
import { countJsonLeaves } from '@/lib/json-utils';

export function ProjectSelector() {
  const {
    projects,
    currentProjectId,
    setCurrentProjectId,
    projectsLoading,
  } = useProject();
  const deleteProjectMutation = useDeleteProject();

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleDeleteProject = async (
    projectId: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (
      confirm(
        'Are you sure you want to delete this project? This action cannot be undone.'
      )
    ) {
      try {
        await deleteProjectMutation.mutateAsync(projectId);

        // If we're deleting the current project, clear selection
        if (projectId === currentProjectId) {
          setCurrentProjectId(null);
        }
      } catch (error) {
        // Error handling is done in the mutation hook
        console.error('Failed to delete project:', error);
      }
    }
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-10 px-3 justify-between min-w-[200px] font-medium bg-transparent shadow-sm hover:shadow-md transition-all duration-200"
          disabled={projectsLoading}
        >
          <div className="flex items-center space-x-2">
            {projectsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
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
            setCurrentProjectId(null);
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

        {/* Loading state */}
        {projectsLoading && (
          <div className="p-6 text-center text-muted-foreground">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-3">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <p className="font-medium mb-1">Loading projects...</p>
            <p className="text-xs">Please wait a moment</p>
          </div>
        )}

        {/* No projects state */}
        {!projectsLoading && projects.length === 0 && (
          <div className="p-6 text-center text-muted-foreground">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <p className="font-medium mb-1">No projects yet</p>
            <p className="text-xs">Create your first project to get started</p>
          </div>
        )}

        {/* Existing projects */}
        {!projectsLoading &&
          projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              className={`
              flex items-center space-x-3 p-3 cursor-pointer group rounded-lg m-1
              ${
                currentProjectId === project.id
                  ? 'bg-muted border border-border'
                  : 'hover:bg-muted/50'
              }
            `}
              onClick={() => setCurrentProjectId(project.id)}
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

                  <span>{countJsonLeaves(project.originalData)} keys</span>

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
                onClick={(e) => handleDeleteProject(project.id, e)}
                disabled={deleteProjectMutation.isPending}
              >
                {deleteProjectMutation.isPending &&
                deleteProjectMutation.variables === project.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </Button>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
