import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Play, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Workflow {
  id: string
  name: string
  description?: string
  steps: any[]
}

export function Dashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/workflows")
      .then(res => res.json())
      .then(data => {
        setWorkflows(data || [])
        setLoading(false)
      })
      .catch(err => {
        console.error("Failed to fetch workflows", err)
        setLoading(false)
      })
  }, [])

  const runWorkflow = async (wf: Workflow) => {
     try {
        const res = await fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflow: wf })
        })
        const result = await res.json()
        alert("Run result: " + JSON.stringify(result, null, 2))
     } catch(e) {
         alert("Failed to run")
     }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Workflows</h2>
        <Link to="/editor/new">
            <Button>
            <Plus className="mr-2 h-4 w-4" /> Create Workflow
            </Button>
        </Link>
      </div>
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((wf) => (
            <Card key={wf.id}>
              <CardHeader>
                <CardTitle>{wf.name}</CardTitle>
                <CardDescription>{wf.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2">
                    <Button size="sm" variant="outline" onClick={() => runWorkflow(wf)}>
                        <Play className="mr-2 h-4 w-4" /> Run
                    </Button>
                    <Link to={`/editor/${wf.id}`}>
                        <Button size="sm" variant="ghost">
                            <Edit className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
              </CardContent>
            </Card>
          ))}
          {workflows.length === 0 && (
              <div className="col-span-full text-center py-10 text-muted-foreground">
                  No workflows found. Create your first one!
              </div>
          )}
        </div>
      )}
    </div>
  )
}
