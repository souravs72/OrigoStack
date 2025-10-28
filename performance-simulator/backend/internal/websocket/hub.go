package websocket

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

// Hub manages WebSocket connections for real-time communication
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan *Message
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// Client represents a WebSocket connection
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan *Message
	id   string
}

// Message represents data sent over WebSocket
type Message struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development
		// In production, implement proper origin checking
		return true
	},
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan *Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			
			logrus.Infof("Client %s connected. Total clients: %d", client.id, len(h.clients))
			
			// Send welcome message
			welcomeMsg := &Message{
				Type: "connection_established",
				Data: map[string]interface{}{
					"client_id": client.id,
					"message":   "Connected to performance simulator",
				},
				Timestamp: getCurrentTimestamp(),
			}
			
			select {
			case client.send <- welcomeMsg:
			default:
				close(client.send)
				delete(h.clients, client)
			}

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				logrus.Infof("Client %s disconnected. Total clients: %d", client.id, len(h.clients))
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// HandleWebSocket handles WebSocket connection upgrades
func (h *Hub) HandleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logrus.Errorf("Failed to upgrade WebSocket connection: %v", err)
		return
	}

	clientID := c.Query("client_id")
	if clientID == "" {
		clientID = generateClientID()
	}

	client := &Client{
		hub:  h,
		conn: conn,
		send: make(chan *Message, 256),
		id:   clientID,
	}

	client.hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// Broadcast sends a message to all connected clients
func (h *Hub) Broadcast(messageType string, data interface{}) {
	message := &Message{
		Type:      messageType,
		Data:      data,
		Timestamp: getCurrentTimestamp(),
	}

	select {
	case h.broadcast <- message:
	default:
		logrus.Warn("Broadcast channel is full, dropping message")
	}
}

// BroadcastToClient sends a message to a specific client
func (h *Hub) BroadcastToClient(clientID string, messageType string, data interface{}) {
	message := &Message{
		Type:      messageType,
		Data:      data,
		Timestamp: getCurrentTimestamp(),
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		if client.id == clientID {
			select {
			case client.send <- message:
			default:
				logrus.Warnf("Failed to send message to client %s", clientID)
			}
			break
		}
	}
}

// GetConnectedClients returns the number of connected clients
func (h *Hub) GetConnectedClients() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// readPump handles incoming messages from client
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	// Set read limits and deadlines
	c.conn.SetReadLimit(512)
	
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logrus.Errorf("WebSocket error for client %s: %v", c.id, err)
			}
			break
		}

		// Handle incoming messages from client
		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			logrus.Errorf("Failed to unmarshal message from client %s: %v", c.id, err)
			continue
		}

		// Process different message types
		c.handleClientMessage(&msg)
	}
}

// writePump handles outgoing messages to client
func (c *Client) writePump() {
	defer c.conn.Close()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteJSON(message); err != nil {
				logrus.Errorf("Failed to write message to client %s: %v", c.id, err)
				return
			}
		}
	}
}

// handleClientMessage processes messages received from clients
func (c *Client) handleClientMessage(msg *Message) {
	switch msg.Type {
	case "ping":
		// Respond to ping with pong
		pongMsg := &Message{
			Type:      "pong",
			Data:      map[string]interface{}{"message": "pong"},
			Timestamp: getCurrentTimestamp(),
		}
		
		select {
		case c.send <- pongMsg:
		default:
			logrus.Warnf("Failed to send pong to client %s", c.id)
		}

	case "subscribe_simulation":
		// Handle simulation subscription
		if data, ok := msg.Data.(map[string]interface{}); ok {
			simulationID := data["simulation_id"]
			logrus.Infof("Client %s subscribed to simulation %v", c.id, simulationID)
		}

	case "unsubscribe_simulation":
		// Handle simulation unsubscription
		if data, ok := msg.Data.(map[string]interface{}); ok {
			simulationID := data["simulation_id"]
			logrus.Infof("Client %s unsubscribed from simulation %v", c.id, simulationID)
		}

	case "get_status":
		// Send current status
		statusMsg := &Message{
			Type: "status_update",
			Data: map[string]interface{}{
				"connected_clients": c.hub.GetConnectedClients(),
				"server_status":     "running",
			},
			Timestamp: getCurrentTimestamp(),
		}
		
		select {
		case c.send <- statusMsg:
		default:
			logrus.Warnf("Failed to send status to client %s", c.id)
		}

	default:
		logrus.Warnf("Unknown message type '%s' from client %s", msg.Type, c.id)
	}
}

// Helper functions

func getCurrentTimestamp() int64 {
	return time.Now().UnixMilli()
}

func generateClientID() string {
	// Simple client ID generation
	// In production, use a more robust method
	return fmt.Sprintf("client_%d", time.Now().UnixNano())
}

// Additional utility methods for specific simulation events

// BroadcastSimulationStart notifies all clients about a new simulation
func (h *Hub) BroadcastSimulationStart(simulationID int64, config interface{}) {
	h.Broadcast("simulation_started", map[string]interface{}{
		"simulation_id": simulationID,
		"config":        config,
	})
}

// BroadcastSimulationUpdate sends real-time simulation metrics
func (h *Hub) BroadcastSimulationUpdate(simulationID int64, metrics interface{}) {
	h.Broadcast("simulation_update", map[string]interface{}{
		"simulation_id": simulationID,
		"metrics":       metrics,
	})
}

// BroadcastSimulationComplete notifies about simulation completion
func (h *Hub) BroadcastSimulationComplete(simulationID int64, results interface{}) {
	h.Broadcast("simulation_completed", map[string]interface{}{
		"simulation_id": simulationID,
		"results":       results,
	})
}

// BroadcastError sends error messages to clients
func (h *Hub) BroadcastError(errorType string, message string, details interface{}) {
	h.Broadcast("error", map[string]interface{}{
		"error_type": errorType,
		"message":    message,
		"details":    details,
	})
}
