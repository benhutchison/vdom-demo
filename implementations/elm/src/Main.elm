port module Main exposing (main)

import Browser
import Html exposing (Html, div, table, thead, tbody, tr, th, td, text)
import Html.Attributes exposing (class)
import Html.Lazy exposing (lazy)
import Json.Decode as D

type alias Flight = { id : String, flightNum : String, status : String, lastPing : String }
type alias Model = { region : String, flights : List Flight }

port stateUpdates : (D.Value -> msg) -> Sub msg

flightDecoder : D.Decoder Flight
flightDecoder =
    D.map4 Flight
        (D.field "id" D.string)
        (D.field "flightNum" D.string)
        (D.field "status" D.string)
        (D.field "lastPing" D.string)

modelDecoder : D.Decoder Model
modelDecoder =
    D.map2 Model
        (D.field "region" D.string)
        (D.field "flights" (D.list flightDecoder))

type Msg = NewState D.Value

main : Program D.Value Model Msg
main =
    Browser.element
        { init = \flags -> ( D.decodeValue modelDecoder flags |> Result.withDefault { region = "Europe", flights = [] }, Cmd.none )
        , update = \(NewState v) _ -> ( D.decodeValue modelDecoder v |> Result.withDefault { region = "Europe", flights = [] }, Cmd.none )
        , view = view
        , subscriptions = \_ -> stateUpdates NewState
        }

viewTabBar : String -> Html Msg
viewTabBar region =
    div []
        [ div [ class "vdom-tabs-label" ] [ text "Region" ]
        , div [ class "vdom-tabs" ]
            (List.map (\r -> div [ class ("vdom-tab" ++ (if r == region then " active" else "")) ] [ text r ])
                [ "Europe", "Africa", "Asia" ])
        ]

viewFlightTable : List Flight -> Html Msg
viewFlightTable flights =
    table [ class "vdom-table" ]
        [ thead [] [ tr [] [ th [] [ text "Flight" ], th [] [ text "Status" ], th [] [ text "Last ping" ] ] ]
        , tbody [] (List.map (\f -> tr [] [ td [] [ text f.flightNum ], td [] [ text f.status ], td [] [ text f.lastPing ] ]) flights)
        ]

view : Model -> Html Msg
view model =
    div []
        [ lazy viewTabBar model.region
        , lazy viewFlightTable model.flights
        ]
