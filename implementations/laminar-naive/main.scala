//> using scala "3.8.3"
//> using platform "js"
//> using dep "com.raquo:laminar_sjs1_3:17.2.1"

import com.raquo.laminar.api.L._
import org.scalajs.dom
import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportTopLevel

case class Flight(id: String, flightNum: String, status: String, lastPing: Int)
case class DemoState(region: String, flights: List[Flight])

def decodeState(v: js.Any): DemoState = {
  val d = v.asInstanceOf[js.Dynamic]
  DemoState(
    region = d.region.asInstanceOf[String],
    flights = d.flights.asInstanceOf[js.Array[js.Dynamic]].toList.map(f =>
      Flight(f.id.asInstanceOf[String], f.flightNum.asInstanceOf[String],
             f.status.asInstanceOf[String], f.lastPing.asInstanceOf[Int]))
  )
}

def renderFlightRow(f: Flight) =
  tr(td(f.flightNum), td(f.status), td(f.lastPing.toString))

def renderTabBar(region: String): Div =
  div(cls := "vdom-tabs",
    List("Europe", "Africa", "Asia").map(r =>
      div(cls := s"vdom-tab${if (r == region) " active" else ""}", r)))

@JSExportTopLevel("__VDOM_DEMO_MOUNT__")
def mount(container: dom.Element, initialStateJs: js.Any): js.Object = {
  val stateVar = Var(decodeState(initialStateJs))

  val app: Div =
    div(
      // BUG, ON PURPOSE: rebuilds and replaces the whole tab bar on every emission,
      // including flights-only ticks where region never changed.
      child <-- stateVar.signal.map(s => renderTabBar(s.region)),
      table(cls := "vdom-table",
        thead(tr(th("Flight"), th("Status"), th("Last ping"))),
        tbody(children <-- stateVar.signal.map(s => s.flights.map(renderFlightRow)))
      )
    )

  render(container, app)
  js.Dynamic.literal(update = (newStateJs: js.Any) => stateVar.set(decodeState(newStateJs)): Unit)
}
