import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Save, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Editor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === "new"
  
  const [name, setName] = useState("")
  const [jsonConfig, setJsonConfig] = useState(JSON.stringify({
      name: "New Workflow",
      steps: []
  }, null, 2))

  useEffect(() => {
    if (!isNew && id) {
        fetch(`/api/workflows/${id}`)
            .then(res => res.json())
            .then(data => {
                setName(data.name)
                setJsonConfig(JSON.stringify(data, null, 2))
            })
            .catch(err => console.error(err))
    }
  }, [id, isNew])

  const save = async () => {
      try {
          const parsed = JSON.parse(jsonConfig)
          const method = isNew ? "POST" : "PUT"
          const url = isNew ? "/api/workflows" : `/api/workflows/${id}`
          
          const res = await fetch(url, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(parsed)
          })
          
          if (!res.ok) throw new Error("Failed to save")
          
          const saved = await res.json()
          alert("Saved!")
          if (isNew) {
              navigate(`/editor/${saved.id}`)
          }
      } catch (e) {
          alert("Error saving: " + e)
      }
  }

  return (
      <div className="space-y-4 h-[calc(100vh-100px)] flex flex-col">
          <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                  <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                      <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-2xl font-bold">{isNew ? "New Workflow" : `Edit: ${name}`}</h2>
              </div>
              <Button onClick={save}>
                  <Save className="mr-2 h-4 w-4" /> Save
              </Button>
          </div>
          
          <div className="flex-1 border rounded-md overflow-hidden">
              <textarea 
                className="w-full h-full p-4 font-mono text-sm bg-muted/50 resize-none focus:outline-none"
                value={jsonConfig}
                onChange={(e) => setJsonConfig(e.target.value)}
              />
          </div>
      </div>
  )
}
