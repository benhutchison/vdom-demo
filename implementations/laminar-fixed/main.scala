//> using scala "3.8.3"
//> using platform "js"
//> using dep "com.raquo:laminar_sjs1_3:17.2.1"

import com.raquo.laminar.api.L._
import org.scalajs.dom
import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportTopLevel

case class Flight(id: String, flightNum: String, status: String, lastPing: String)
case class DemoState(region: String, flights: List[Flight])

def decodeState(v: js.Any): DemoState = {
  val d = v.asInstanceOf[js.Dynamic]
  DemoState(
    region = d.region.asInstanceOf[String],
    flights = d.flights.asInstanceOf[js.Array[js.Dynamic]].toList.map(f =>
      Flight(f.id.asInstanceOf[String], f.flightNum.asInstanceOf[String],
             f.status.asInstanceOf[String], f.lastPing.asInstanceOf[String]))
  )
}

// The row element is created once per stable Flight.id and reused; the
// per-row signal channels updates into individual cells instead of
// recreating the <tr> subtree.
def renderFlightRow(flightId: String, initial: Flight, flightSignal: Signal[Flight]): HtmlElement =
  tr(
    td(text <-- flightSignal.map(_.flightNum).distinct),
    td(text <-- flightSignal.map(_.status).distinct),
    td(text <-- flightSignal.map(_.lastPing).distinct)
  )

@JSExportTopLevel("__VDOM_DEMO_MOUNT__")
def mount(container: dom.Element, initialStateJs: js.Any): js.Object = {
  val stateVar = Var(decodeState(initialStateJs))
  val regionSignal = stateVar.signal.map(_.region).distinct
  val flightsSignal = stateVar.signal.map(_.flights)

  val app: Div =
    div(
      div(cls := "vdom-tabs-label", "Region"), // static - never touched by any signal
      div(cls := "vdom-tabs",
        List("Europe", "Africa", "Asia").map(r =>
          div(cls <-- regionSignal.map(cur => s"vdom-tab${if (r == cur) " active" else ""}"))
        )
      ),
      table(cls := "vdom-table",
        thead(tr(th("Flight"), th("Status"), th("Last ping"))),
        tbody(children <-- flightsSignal.split(_.id)(renderFlightRow))
      )
    )

  render(container, app)
  js.Dynamic.literal(update = (newStateJs: js.Any) => stateVar.set(decodeState(newStateJs)): Unit)
}
